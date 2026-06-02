/**
 * Extract all unique page IDs from HTML mention spans.
 * Looks for `data-page-id="..."` attributes in the HTML.
 */
export function extractMentionPageIds(html: string): string[] {
  const regex = /data-page-id="(\d+)"/g
  const ids = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    ids.add(match[1])
  }
  return [...ids]
}

/** Normalize HTML into individual non-empty text lines */
export function splitHtmlLines(html: string): string[] {
  return html
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Split HTML into individual lines and return ALL lines mentioning a specific page. */
export function filterHtmlToMentionLines(html: string, pageId: number): string[] {
  const marker = `data-page-id="${String(pageId)}"`
  const lines = splitHtmlLines(html)
  return lines.filter((line) => line.includes(marker))
}
