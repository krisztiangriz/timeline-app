import type { Page } from '../types'

/**
 * Enrich mention spans in HTML with `data-trigger`, `title`, and optionally `data-collapsed` attributes.
 * This enables CSS-based collapsing of mention names to just the trigger character.
 *
 * @param html - The raw HTML containing mention spans
 * @param allPages - All pages to look up trigger characters and collapse settings
 * @param collapse - When true, adds data-collapsed for hubs with mentionCollapsed (default false)
 * @returns Enriched HTML with attributes on mention spans
 */
export function enrichMentionHtml(html: string, allPages: Page[], collapse = false): string {
  if (!html || !html.includes('data-mention')) return html

  // Build lookup: pageId → { trigger, collapsed }
  const mentionInfo = new Map<number, { trigger: string; collapsed: boolean }>()
  for (const page of allPages) {
    if (page.mentionTrigger) {
      // The hub itself
      mentionInfo.set(page.id!, { trigger: page.mentionTrigger, collapsed: !!page.mentionCollapsed })
      // All children of this hub
      for (const child of allPages) {
        if (child.parentId === page.id) {
          mentionInfo.set(child.id!, { trigger: page.mentionTrigger, collapsed: !!page.mentionCollapsed })
        }
      }
    }
  }

  // Enrich mention spans with data-trigger, title, and optionally data-collapsed
  return html.replace(
    /<span([^>]*data-mention="true"[^>]*data-page-id="(\d+)"[^>]*)>([^<]*)<\/span>/gi,
    (match, attrs, pageIdStr, textContent) => {
      const pageId = Number(pageIdStr)
      const info = mentionInfo.get(pageId)
      if (!info) return match

      const collapsedAttr = collapse && info.collapsed ? ' data-collapsed="true"' : ''

      // Skip if already has data-trigger (re-enrichment safety)
      if (attrs.includes('data-trigger')) {
        // Still update collapsed state
        const cleaned = attrs.replace(/ data-collapsed="[^"]*"/g, '')
        return `<span${cleaned}${collapsedAttr}>${textContent}</span>`
      }

      return `<span${attrs} data-trigger="${info.trigger}" title="${textContent}"${collapsedAttr}>${textContent}</span>`
    }
  )
}

/**
 * Get the set of trigger characters that should be collapsed (show trigger only, not name).
 */
export function getCollapsedTriggers(allPages: Page[]): string[] {
  return allPages
    .filter((p) => p.mentionTrigger && p.mentionCollapsed)
    .map((p) => p.mentionTrigger!)
}
