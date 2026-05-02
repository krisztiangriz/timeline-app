import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Block, BlockType, Page } from '../types'

/**
 * Get all blocks for a page (optionally filtered by tab), ordered.
 */
export function useBlocks(pageId?: number, tabId?: number | null) {
  return useLiveQuery(
    () => {
      if (!pageId) return []
      return db.blocks
        .where('pageId')
        .equals(pageId)
        .filter((b) => tabId === undefined ? true : (tabId === null ? !b.tabId : b.tabId === tabId))
        .sortBy('order')
    },
    [pageId, tabId]
  ) ?? []
}

/**
 * Required block types for each page context.
 * Returns the set of block types that cannot be deleted (if they're the only one of that type).
 */
async function getRequiredBlockTypes(pageId: number): Promise<Set<BlockType>> {
  const page = await db.pages.get(pageId)
  if (!page) return new Set()

  // Main timeline page
  if (page.role === 'main-timeline') return new Set(['timeline'])

  // Hub pages themselves
  if (page.type === 'hub') return new Set(['visualization', 'table'])

  // Child pages — check parent hub role
  if (page.parentId) {
    const parent = await db.pages.get(page.parentId)
    if (parent?.role === 'colleague-hub') return new Set(['timeline', 'feedback', 'visualization'])
    if (parent?.role === 'project-hub') return new Set(['visualization', 'feedback', 'timeline'])
    if (parent?.role === 'candidate-hub') return new Set(['text'])
    if (parent?.type === 'hub') return new Set(['visualization', 'timeline']) // generic hub child
  }

  return new Set()
}

/**
 * Synchronous version for UI — derives required types from page + allPages context.
 */
export function getRequiredBlockTypesSync(page: Page, allPages: Page[]): Set<BlockType> {
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

/**
 * CRUD operations for blocks.
 */
export function useBlockActions() {
  async function addBlock(pageId: number, type: BlockType, tabId?: number, content?: string): Promise<number> {
    const maxOrder = await db.blocks
      .where('pageId').equals(pageId)
      .filter((b) => tabId ? b.tabId === tabId : !b.tabId)
      .last()
    const order = (maxOrder?.order ?? -1) + 1
    const id = await db.blocks.add({ pageId, tabId, type, content, order })
    return id as number
  }

  async function insertBlockAfter(afterBlockId: number, pageId: number, type: BlockType, tabId?: number, content?: string): Promise<number> {
    const afterBlock = await db.blocks.get(afterBlockId)
    if (!afterBlock) return addBlock(pageId, type, tabId, content)

    // Shift subsequent blocks
    const subsequent = await db.blocks
      .where('pageId').equals(pageId)
      .filter((b) => b.order > afterBlock.order && (tabId ? b.tabId === tabId : !b.tabId))
      .toArray()
    for (const b of subsequent) {
      await db.blocks.update(b.id!, { order: b.order + 2 })
    }

    const id = await db.blocks.add({
      pageId, tabId, type, content, order: afterBlock.order + 1,
    })
    return id as number
  }

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

  return { insertBlockAfter, updateBlock, deleteBlock }
}
