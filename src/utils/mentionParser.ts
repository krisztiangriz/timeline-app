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

/**
 * Strip the mention span for a specific page from HTML.
 * Removes `<span data-mention="true" data-page-id="{pageId}" ...>...</span>` and cleans up.
 * Capitalizes the first visible letter of the remaining text.
 * Returns empty string if nothing meaningful remains.
 */
export function stripSelfMention(html: string, pageId: number): string {
  const pageIdStr = String(pageId)
  // Unwrap the mention span for this page: keep inner text, remove span tags
  let result = html.replace(
    new RegExp(`<span[^>]*data-page-id="${pageIdStr}"[^>]*>([\\s\\S]*?)</span>`, 'gi'),
    '$1'
  )
  // Clean up leading/trailing whitespace, &nbsp;, and <br>
  result = result.replace(/^(\s|&nbsp;|<br\s*\/?>)+/gi, '')
  result = result.replace(/(\s|&nbsp;|<br\s*\/?>)+$/gi, '')
  result = result.trim()

  if (!result || result === '&nbsp;') return ''
  return result
}
export function filterHtmlToMention(html: string, pageId: number): string {
  const pageIdStr = String(pageId)
  const marker = `data-page-id="${pageIdStr}"`

  // Normalize all line break patterns to \n, then split
  const lines = html
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')  // </div><div> boundary
    .replace(/<div[^>]*>/gi, '\n')             // opening <div> (new line)
    .replace(/<\/div>/gi, '')                   // closing </div>
    .replace(/<br\s*\/?>/gi, '\n')             // <br> variants
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const matching = lines.find((line) => line.includes(marker))

  if (!matching) return html // fallback: show full text
  return matching
}

/** Split HTML into individual lines and return ALL lines mentioning a specific page. */
export function filterHtmlToMentionLines(html: string, pageId: number): string[] {
  const pageIdStr = String(pageId)
  const marker = `data-page-id="${pageIdStr}"`

  const lines = html
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const matching = lines.filter((line) => line.includes(marker))
  return matching.length > 0 ? matching : [html]
}
