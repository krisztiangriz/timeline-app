import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Block, BlockType, Page } from '../types'

/**
 * Get all blocks for a page (optionally filtered by tab).
 */
export function useBlocks(pageId?: number, tabId?: number | null) {
  return useLiveQuery(
    () => {
      if (!pageId) return []
      // Use compound index when filtering by a specific tab
      if (typeof tabId === 'number') {
        return db.blocks
          .where('[pageId+tabId]')
          .equals([pageId, tabId])
          .toArray()
      }
      // Page-level blocks (no tab) or all blocks
      return db.blocks
        .where('pageId')
        .equals(pageId)
        .filter((b) => tabId === undefined ? true : !b.tabId)
        .toArray()
    },
    [pageId, tabId]
  ) ?? []
}

/**
 * Required block types for each page context (sync version for UI).
 */
function getRequiredBlockTypesSync(page: Page, allPages: Page[]): Set<BlockType> {
  if (page.role === 'main-timeline') return new Set(['timeline'])
  if (page.type === 'hub') return new Set(['visualization', 'table'])

  if (page.parentId) {
    const parent = allPages.find((p) => p.id === page.parentId)
    if (parent?.role === 'colleague-hub') return new Set(['timeline', 'feedback', 'visualization'])
    if (parent?.role === 'project-hub') return new Set(['visualization', 'feedback', 'timeline'])
    if (parent?.role === 'candidate-hub') return new Set(['text'])
    if (parent?.type === 'hub') return new Set(['visualization', 'timeline'])
  }

  return new Set()
}

/** Async version — fetches page + parent from DB, then delegates to sync logic */
async function getRequiredBlockTypes(pageId: number): Promise<Set<BlockType>> {
  const page = await db.pages.get(pageId)
  if (!page) return new Set()
  const allPages = page.parentId ? [page, ...(await db.pages.where('parentId').equals(page.parentId).toArray()), ...(page.parentId ? [await db.pages.get(page.parentId)].filter(Boolean) as Page[] : [])] : [page]
  return getRequiredBlockTypesSync(page, allPages)
}

/**
 * CRUD operations for blocks.
 */
export function useBlockActions() {
  async function updateBlock(id: number, data: Partial<Omit<Block, 'id'>>) {
    await db.blocks.update(id, data)
  }

  async function deleteBlock(id: number) {
    const block = await db.blocks.get(id)
    if (!block) return

    // Check if this block is protected (required and sole of its type in the first tab)
    const required = await getRequiredBlockTypes(block.pageId)
    if (required.has(block.type)) {
      // Only protect blocks in the first tab (or at page level if no tabs)
      let isFirstTab = true
      if (block.tabId) {
        const tabs = await db.layouts.where('pageId').equals(block.pageId).sortBy('order')
        isFirstTab = tabs.length > 0 && tabs[0].id === block.tabId
      }
      if (isFirstTab) {
        const siblings = await db.blocks
          .where('pageId').equals(block.pageId)
          .filter((b) =>
            b.type === block.type &&
            (block.tabId ? b.tabId === block.tabId : !b.tabId)
          )
          .toArray()
        if (siblings.length <= 1) return // can't delete the last required block in overview tab
      }
    }

    // Cascade: clean up chartConfigs for visualization blocks
    if (block.type === 'visualization') {
      await db.chartConfigs.where('blockId').equals(id).delete()
    }

    await db.blocks.delete(id)
  }

  return { updateBlock, deleteBlock }
}
