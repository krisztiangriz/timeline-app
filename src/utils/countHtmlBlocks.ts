import { splitHtmlLines } from './mentionParser'

/**
 * Count individual entries in a timeline entry's HTML text.
 *
 * The app stores a day's content as: `text<div>text</div><div>text</div>`.
 * Each non-empty top-level segment (before the first <div> + each <div> block)
 * counts as one entry.
 *
 * Uses a regex split (no DOM allocation) for performance inside useMemo loops.
 */
export function countHtmlBlocks(html: string): number {
  if (!html || !html.trim()) return 0

  // Split on opening <div> tags (case-insensitive)
  const parts = html.split(/<div[^>]*>/i)

  let count = 0
  for (const part of parts) {
    // Strip closing </div> tags and remaining HTML tags, then check if non-empty
    const text = part
      .replace(/<\/div>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()
    if (text) count++
  }

  // At least 1 if the original html was non-empty (safety fallback)
  return Math.max(count, 1)
}

/**
 * Count only the HTML lines that mention a specific page (by data-page-id).
 *
 * Used for cross-referenced entries: an entry from Page A that mentions Page B
 * may contain many lines, but only some mention Page B. This counts just those.
 */
export function countMentionBlocks(html: string, pageId: number): number {
  if (!html || !html.trim()) return 0

  const marker = `data-page-id="${pageId}"`
  const lines = splitHtmlLines(html)
  return lines.filter((l) => l.includes(marker)).length
}
