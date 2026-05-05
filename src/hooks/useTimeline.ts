import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { TimelineEntry } from '../types'
import { extractMentionPageIds } from '../utils/mentionParser'

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

// Standalone async functions — stable references, no hook overhead

export async function addEntry(
  data: Pick<TimelineEntry, 'pageId' | 'text' | 'isPending'>
): Promise<number> {
  const now = new Date()
  const tagRefs = extractMentionPageIds(data.text)

  const id = await db.timelineEntries.add({
    ...data,
    date: now,
    tagRefs,
    createdAt: now,
    updatedAt: now,
  })

  // Update parent page's updatedAt
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

  // Re-parse mentions if text changed
  if (data.text !== undefined) {
    updates.tagRefs = extractMentionPageIds(data.text)
  }

  await db.timelineEntries.update(id, updates)
}

export async function deleteEntry(id: number) {
  await db.timelineEntries.delete(id)
}

/**
 * Merge multiple isPending entries for a page into a single record.
 * Each existing entry's text is wrapped in a <div> with a checkbox prepended.
 * Returns the merged entry's ID (or undefined if no pending entries existed).
 */
export async function mergePendingEntries(pageId: number): Promise<number | undefined> {
  const pendingEntries = await db.timelineEntries
    .where('pageId')
    .equals(pageId)
    .filter((e) => e.isPending)
    .sortBy('date')

  if (pendingEntries.length <= 1) {
    // Nothing to merge — return existing ID if any
    return pendingEntries[0]?.id
  }

  // Build merged HTML: each entry becomes a <div> with a checkbox
  const lines = pendingEntries.map((e) => {
    const text = e.text.trim()
    // If the text already contains a data-checkbox span, keep as-is
    if (text.includes('data-checkbox')) return `<div>${text}</div>`
    return `<div><span data-checkbox="false">\u00A0</span>${text}</div>`
  })
  const mergedHtml = lines.join('')

  const now = new Date()
  const tagRefs = extractMentionPageIds(mergedHtml)

  // Create the merged entry
  const mergedId = await db.timelineEntries.add({
    pageId,
    text: mergedHtml,
    isPending: true,
    date: pendingEntries[0].date, // keep earliest date
    tagRefs,
    createdAt: pendingEntries[0].createdAt,
    updatedAt: now,
  })

  // Delete the old entries
  const idsToDelete = pendingEntries.map((e) => e.id!)
  await db.timelineEntries.bulkDelete(idsToDelete)

  return mergedId as number
}
