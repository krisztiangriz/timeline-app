/** Strip HTML tags for plain text operations (regex-based, no DOM allocation) */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

/** Strip data-checkbox spans from HTML, keeping inner text and all other formatting */
export function stripCheckboxHtml(html: string): string {
  return html.replace(/<span data-checkbox="[^"]*">([\s\S]*?)<\/span>/g, '$1').trim()
}
