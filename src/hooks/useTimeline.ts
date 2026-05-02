import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { TimelineEntry } from '../types'
import { extractMentionPageIds } from '../utils/mentionParser'
import { parseTicketId } from '../utils/ticketParser'

/**
 * Get timeline entries for a specific page, ordered by date descending.
 */
export function useTimelineEntries(pageId?: number) {
  return useLiveQuery(
    () => {
      if (!pageId) return []
      return db.timelineEntries
        .where('pageId')
        .equals(pageId)
        .reverse()
        .sortBy('date')
    },
    [pageId]
  ) ?? []
}

/**
 * Get entries that mention a specific page (for cross-referencing).
 * Queries entries where tagRefs contains the given page ID as a string.
 */
export function useCrossRefEntries(pageId?: number) {
  const pageIdStr = pageId ? String(pageId) : ''
  return useLiveQuery(
    () => {
      if (!pageIdStr) return []
      return db.timelineEntries
        .where('tagRefs')
        .equals(pageIdStr)
        .toArray()
        .catch(() =>
          db.timelineEntries
            .filter((e) => e.tagRefs.includes(pageIdStr))
            .toArray()
        )
    },
    [pageIdStr]
  ) ?? []
}

/**
 * CRUD operations for timeline entries.
 */
export function useTimelineActions() {
  async function addEntry(
    data: Pick<TimelineEntry, 'pageId' | 'text' | 'isPending'>
  ): Promise<number> {
    const now = new Date()
    const tagRefs = extractMentionPageIds(data.text)
    const ticketId = parseTicketId(data.text)

    const id = await db.timelineEntries.add({
      ...data,
      date: now,
      tagRefs,
      isCompleted: false,
      ticketId,
      createdAt: now,
      updatedAt: now,
    })

    // Update parent page's updatedAt
    await db.pages.update(data.pageId, { updatedAt: now })

    return id as number
  }

  async function updateEntry(
    id: number,
    data: Partial<Omit<TimelineEntry, 'id' | 'createdAt'>>
  ) {
    const updates: Partial<TimelineEntry> = {
      ...data,
      updatedAt: new Date(),
    }

    // Re-parse mentions and ticket if text changed
    if (data.text !== undefined) {
      updates.tagRefs = extractMentionPageIds(data.text)
      updates.ticketId = parseTicketId(data.text)
    }

    await db.timelineEntries.update(id, updates)
  }

  async function deleteEntry(id: number) {
    await db.timelineEntries.delete(id)
  }

  return { addEntry, updateEntry, deleteEntry }
}
