import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Page, PageRole, BlockType } from '../types'

/**
 * Get child pages of a given parent.
 */
export function useChildPages(parentId?: number): Page[] {
  return useLiveQuery(
    () => {
      if (!parentId) return Promise.resolve([] as Page[])
      return db.pages.where('parentId').equals(parentId).toArray()
    },
    [parentId]
  ) ?? []
}

/**
 * Get a single page by ID.
 */
export function usePage(id?: number) {
  return useLiveQuery(
    () => {
      if (!id) return undefined
      return db.pages.get(id)
    },
    [id]
  )
}

/**
 * Get a single page by its stable role identifier.
 */
export function usePageByRole(role: PageRole) {
  return useLiveQuery(
    () => db.pages.where('role').equals(role).first(),
    [role]
  )
}

/**
 * Get tabs for a page.
 */
export function usePageTabs(pageId?: number) {
  return useLiveQuery(
    () => {
      if (!pageId) return []
      return db.layouts.where('pageId').equals(pageId).sortBy('order')
    },
    [pageId]
  ) ?? []
}

/**
 * CRUD operations for pages.
 */
export function usePageActions() {
  async function addPage(
    data: Omit<Page, 'id' | 'createdAt' | 'updatedAt' | 'editCount'>,
    tabs?: string[]
  ): Promise<number> {
    const now = new Date()
    const id = await db.pages.add({
      ...data,
      createdAt: now,
      updatedAt: now,
      editCount: 0,
    })

    if (tabs?.length) {
      await db.layouts.bulkAdd(
        tabs.map((name, i) => ({
          pageId: id as number,
          type: 'tab' as const,
          name,
          order: i,
        }))
      )
    }

    return id as number
  }

  async function updatePage(
    id: number,
    data: Partial<Omit<Page, 'id' | 'createdAt'>>
  ) {
    const page = await db.pages.get(id)
    if (!page) return

    const updates: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
      editCount: page.editCount + 1,
    }
    if ('parentId' in data && data.parentId === undefined) {
      // Dexie cannot unset indexed fields with undefined; use 0 as a sentinel for "no parent".
      // This works because 0 is falsy, so `if (page.parentId)` correctly treats it as root-level.
      updates.parentId = 0
    }
    // Allow clearing optional fields by explicitly setting undefined
    if ('role' in data && data.role === undefined) {
      updates.role = undefined
    }
    if ('mentionTrigger' in data && data.mentionTrigger === undefined) {
      updates.mentionTrigger = undefined
    }

    await db.pages.update(id, updates)
  }

  async function deletePage(id: number) {
    // Prevent deleting structural pages (those with a role)
    const target = await db.pages.get(id)
    if (target?.role) return

    await db.transaction('rw', [db.pages, db.layouts, db.blocks, db.timelineEntries, db.feedbacks, db.chartConfigs, db.pagePropertyValues], async () => {
      async function deleteRecursive(pageId: number) {
        const children = await db.pages.where('parentId').equals(pageId).toArray()
        for (const child of children) {
          await deleteRecursive(child.id!)
        }
        // Cascade: batch delete chartConfigs for visualization blocks
        const vizBlocks = await db.blocks.where('pageId').equals(pageId).filter((b) => b.type === 'visualization').toArray()
        const vizBlockIds = vizBlocks.map((b) => b.id!)
        if (vizBlockIds.length > 0) {
          await db.chartConfigs.where('blockId').anyOf(vizBlockIds).delete()
        }
        await db.blocks.where('pageId').equals(pageId).delete()
        await db.layouts.where('pageId').equals(pageId).delete()
        await db.timelineEntries.where('pageId').equals(pageId).delete()
        await db.feedbacks.where('subjectId').equals(pageId).delete()
        await db.pagePropertyValues.where('pageId').equals(pageId).delete()
        await db.pages.delete(pageId)
      }
      await deleteRecursive(id)
    })
  }

  async function updateTabs(pageId: number, tabs: { id?: number; name: string; type: BlockType }[]) {
    await db.transaction('rw', [db.pages, db.layouts, db.blocks, db.chartConfigs], async () => {
      const existing = await db.layouts.where('pageId').equals(pageId).sortBy('order')
      const submittedIds = new Set(tabs.filter((t) => t.id).map((t) => t.id!))

      // Update or create tabs in the new order
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i]
        if (tab.id) {
          // Existing tab — update name and order
          await db.layouts.update(tab.id, { name: tab.name, order: i })
        } else {
          // New tab — create it + its block
          const tabId = await db.layouts.add({ pageId, type: 'tab' as const, name: tab.name, order: i })
          await db.blocks.add({ pageId, tabId: tabId as number, type: tab.type, ...(tab.type === 'text' ? { content: '' } : {}) })
        }
      }

      // Delete tabs that were removed (exist in DB but not in submitted list)
      for (const ex of existing) {
        if (!submittedIds.has(ex.id!)) {
          const tabBlocks = await db.blocks.where('pageId').equals(pageId).filter((b) => b.tabId === ex.id!).toArray()
          for (const b of tabBlocks) {
            if (b.type === 'visualization' && b.id) {
              await db.chartConfigs.where('blockId').equals(b.id).delete()
            }
            if (b.id) await db.blocks.delete(b.id)
          }
          await db.layouts.delete(ex.id!)
        }
      }
    })
  }

  async function archivePage(id: number) {
    const page = await db.pages.get(id)
    if (!page || page.role === 'main-timeline') return
    await db.pages.update(id, { archived: true })
    // If hub, archive all children in one batch
    if (page.type === 'hub') {
      await db.pages.where('parentId').equals(id).modify({ archived: true })
    }
  }

  async function unarchivePage(id: number) {
    const page = await db.pages.get(id)
    if (!page) return
    await db.pages.update(id, { archived: false })
    // If hub, unarchive all children in one batch
    if (page.type === 'hub') {
      await db.pages.where('parentId').equals(id).modify({ archived: false })
    }
  }

  return { addPage, updatePage, deletePage, updateTabs, archivePage, unarchivePage }
}

/**
 * Build a flat list of pages for the root index,
 * with children nested under their parent.
 */
interface PageRow {
  page: Page
  depth: number
}

export function buildFlatPageList(pages: Page[]): PageRow[] {
  const roots = pages.filter((p) => !p.parentId)
  const childMap = new Map<number, Page[]>()

  for (const p of pages) {
    if (p.parentId) {
      const siblings = childMap.get(p.parentId) ?? []
      siblings.push(p)
      childMap.set(p.parentId, siblings)
    }
  }

  const result: PageRow[] = []
  function walk(list: Page[], depth: number) {
    for (const page of list) {
      result.push({ page, depth })
      const children = childMap.get(page.id!) ?? []
      walk(children, depth + 1)
    }
  }
  walk(roots, 0)
  return result
}

/**
 * Get the route path for a page based on its role and parent.
 */
export function getPagePath(page: Page, allPages: Page[]): string {
  // Hub pages identified by role
  if (page.role === 'colleague-hub') return '/colleagues'
  if (page.role === 'candidate-hub') return '/candidates'
  if (page.role === 'project-hub') return '/projects'
  if (page.role === 'main-timeline') return '/timeline'

  // Child pages — check parent's role
  if (page.parentId) {
    const parent = allPages.find((p) => p.id === page.parentId)
    if (parent?.role === 'colleague-hub') return `/colleagues/${page.id}`
    if (parent?.role === 'candidate-hub') return `/candidates/${page.id}`
    if (parent?.role === 'project-hub') return `/projects/${page.id}`
  }

  return `/page/${page.id}`
}

