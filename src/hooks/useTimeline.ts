import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { TimelineEntry } from '../types'
import { extractMentionPageIds, extractEntryTagSlugs } from '../utils/mentionParser'

/**
 * Get timeline entries for a specific page, ordered by date descending.
 * Uses [pageId+date] compound index for cursor-ordered reads (no in-memory sort).
 */
export function useTimelineEntries(pageId?: number) {
  return useLiveQuery(
    () => {
      if (!pageId) return []
      return db.timelineEntries
        .where('[pageId+date]')
        .between([pageId, Dexie.minKey], [pageId, Dexie.maxKey])
        .reverse()
        .toArray()
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
    },
    [pageIdStr]
  ) ?? []
}

/**
 * Get only the pending entry for a page (avoids loading all entries).
 * Uses pageId index to scope the scan to one page's entries; JS filter
 * for isPending (booleans not reliably indexable in IndexedDB).
 */
export function usePendingEntry(pageId?: number) {
  return useLiveQuery(
    () => {
      if (!pageId) return undefined
      return db.timelineEntries
        .where('pageId')
        .equals(pageId)
        .filter((e) => !!e.isPending)
        .first()
    },
    [pageId]
  )
}

// Standalone async functions — stable references, no hook overhead

export async function addEntry(
  data: Pick<TimelineEntry, 'pageId' | 'text' | 'isPending'> & { date?: Date; createdAt?: Date }
): Promise<number> {
  const now = new Date()
  const tagRefs = extractMentionPageIds(data.text)
  const tagSlugs = extractEntryTagSlugs(data.text)

  const id = await db.timelineEntries.add({
    pageId: data.pageId,
    text: data.text,
    isPending: data.isPending,
    date: data.date ?? now,
    tagRefs,
    tagSlugs,
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  })

  await db.pages.update(data.pageId, { updatedAt: now })

  return id as number
}

export async function updateEntry(
  id: number,
  data: Partial<Omit<TimelineEntry, 'id' | 'createdAt'>>
) {
  const updates: Partial<TimelineEntry> = {
    ...data,
    updatedAt: new Date(),
  }

  // Re-parse mentions and tags if text changed
  if (data.text !== undefined) {
    updates.tagRefs = extractMentionPageIds(data.text)
    updates.tagSlugs = extractEntryTagSlugs(data.text)
  }

  await db.timelineEntries.update(id, updates)
}

export async function deleteEntry(id: number) {
  await db.timelineEntries.delete(id)
}

