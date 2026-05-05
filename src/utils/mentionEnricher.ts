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
 * Extract unique trigger characters from collapsed mentions in an HTML string.
 * Returns an array of trigger chars (e.g., ['#', '@']) for display in the gutter.
 */
export function extractCollapsedTriggers(html: string, allPages: Page[]): string[] {
  if (!html || !html.includes('data-page-id')) return []

  // Build lookup: pageId → trigger (only for collapsed hubs)
  const collapsedTriggerByPageId = new Map<number, string>()
  for (const page of allPages) {
    if (page.mentionTrigger && page.mentionCollapsed) {
      collapsedTriggerByPageId.set(page.id!, page.mentionTrigger)
      for (const child of allPages) {
        if (child.parentId === page.id) {
          collapsedTriggerByPageId.set(child.id!, page.mentionTrigger)
        }
      }
    }
  }

  if (collapsedTriggerByPageId.size === 0) return []

  // Extract page IDs from mention spans
  const regex = /data-page-id="(\d+)"/g
  const triggers = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    const trigger = collapsedTriggerByPageId.get(Number(match[1]))
    if (trigger) triggers.add(trigger)
  }

  return [...triggers]
}
