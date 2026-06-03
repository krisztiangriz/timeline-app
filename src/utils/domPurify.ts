type PurifyConfig = Record<string, unknown>
type PurifyInstance = { sanitize: (html: string, config?: PurifyConfig) => string }

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

export function sanitizeForDisplay(html: string): string {
  if (!purifyInstance) return ''
  return purifyInstance.sanitize(html)
}

export function sanitizeForEditor(html: string): string {
  if (!purifyInstance) return html
  return purifyInstance.sanitize(html, { ADD_ATTR: ['contenteditable', 'target'] })
}

const PASTE_ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 'a', 'h1', 'h2', 'h3',
  'pre', 'code', 'ul', 'ol', 'li', 'blockquote', 'br', 'span', 'div', 'p',
]
const PASTE_ALLOWED_ATTR = [
  'href', 'target', 'rel', 'data-list-style', 'data-checkbox',
  'data-mention', 'data-page-id', 'data-trigger', 'data-collapsed',
  'contenteditable',
]

export function sanitizeForPaste(html: string): string {
  if (!purifyInstance) return ''
  return purifyInstance.sanitize(html, {
    ALLOWED_TAGS: PASTE_ALLOWED_TAGS,
    ALLOWED_ATTR: PASTE_ALLOWED_ATTR,
  })
}
