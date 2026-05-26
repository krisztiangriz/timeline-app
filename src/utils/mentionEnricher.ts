import type { Page } from '../types'

// Cache the mentionInfo map to avoid rebuilding O(n²) on every call
let cachedPages: Page[] | null = null
let cachedMentionInfo: Map<number, { trigger: string; collapsed: boolean }> = new Map()

function getMentionInfo(allPages: Page[]): Map<number, { trigger: string; collapsed: boolean }> {
  if (cachedPages === allPages) return cachedMentionInfo
  const info = new Map<number, { trigger: string; collapsed: boolean }>()

  // Build parentId → trigger lookup (only hubs have mentionTrigger)
  const hubTriggers = new Map<number, { trigger: string; collapsed: boolean }>()
  for (const page of allPages) {
    if (page.mentionTrigger) {
      const entry = { trigger: page.mentionTrigger, collapsed: !!page.mentionCollapsed }
      info.set(page.id!, entry)
      hubTriggers.set(page.id!, entry)
    }
  }

  // Single pass: assign hub trigger to children via parentId lookup
  for (const page of allPages) {
    if (page.parentId && hubTriggers.has(page.parentId)) {
      info.set(page.id!, hubTriggers.get(page.parentId)!)
    }
  }

  cachedPages = allPages
  cachedMentionInfo = info
  return info
}

/**
 * Enrich mention spans in HTML with `data-trigger`, `title`, and optionally `data-collapsed` attributes.
 */
export function enrichMentionHtml(html: string, allPages: Page[], collapse = false): string {
  if (!html || !html.includes('data-mention')) return html

  const mentionInfo = getMentionInfo(allPages)

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

      const safeTrigger = info.trigger.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const safeTitle = textContent.replace(/"/g, '&quot;')
      return `<span${attrs} data-trigger="${safeTrigger}" title="${safeTitle}"${collapsedAttr}>${textContent}</span>`
    }
  )
}

