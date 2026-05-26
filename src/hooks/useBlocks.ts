import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Block } from '../types'

/**
 * Get blocks for a page.
 * - tabId = number → blocks for that specific tab
 * - tabId = null → page-level blocks only (no tab)
 * - tabId = undefined → all blocks for the page
 */
export function useBlocks(pageId?: number, tabId?: number | null) {
  return useLiveQuery(
    () => {
      if (!pageId) return []
      if (typeof tabId === 'number') {
        return db.blocks
          .where('[pageId+tabId]')
          .equals([pageId, tabId])
          .toArray()
      }
      if (tabId === null) {
        return db.blocks
          .where('pageId')
          .equals(pageId)
          .filter((b) => !b.tabId)
          .toArray()
      }
      return db.blocks.where('pageId').equals(pageId).toArray()
    },
    [pageId, tabId]
  ) ?? []
}

/** Update a block's fields by ID */
export async function updateBlock(id: number, data: Partial<Omit<Block, 'id'>>) {
  await db.blocks.update(id, data)
}
