/**
 * Safe localStorage wrapper that handles QuotaExceededError (Safari Private Browsing)
 * and other storage failures gracefully. Dispatches a one-time 'storage-unavailable'
 * custom event on first failure so the app root can show a toast warning.
 */

let warned = false

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    if (!warned) {
      warned = true
      window.dispatchEvent(new CustomEvent('storage-unavailable'))
    }
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // silent
  }
}
