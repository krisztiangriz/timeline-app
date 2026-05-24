import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Block } from '../types'

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

/** Update a block's fields by ID */
export async function updateBlock(id: number, data: Partial<Omit<Block, 'id'>>) {
  await db.blocks.update(id, data)
}
