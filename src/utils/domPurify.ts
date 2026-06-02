// Lazy-loaded DOMPurify singleton — loaded once at module level, all instances
// notified via useSyncExternalStore (see RichTextDisplay).
type PurifyInstance = { sanitize: (html: string, config?: { ADD_ATTR?: string[] }) => string }

let purifyInstance: PurifyInstance | null = null
let purifyLoaded = false
const listeners = new Set<() => void>()

export function subscribePurify(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function getPurifyLoaded(): boolean { return purifyLoaded }

import('dompurify').then((mod) => {
  purifyInstance = mod.default as PurifyInstance
  purifyLoaded = true
  listeners.forEach((cb) => cb())
})

/** For read-only display — strips dangerous content, preserves data-* (DOMPurify default). */
export function sanitizeForDisplay(html: string): string {
  if (!purifyInstance) return ''
  return purifyInstance.sanitize(html)
}

/**
 * For editor and DOM parsing — strips event handlers/scripts while preserving
 * contenteditable and target attributes used by editor-inserted links.
 * Returns html unchanged if DOMPurify has not loaded yet (same as current behaviour).
 */
export function sanitizeForEditor(html: string): string {
  if (!purifyInstance) return html
  return purifyInstance.sanitize(html, { ADD_ATTR: ['contenteditable', 'target'] })
}
