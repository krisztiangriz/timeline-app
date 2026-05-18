import { useSyncExternalStore, useCallback } from 'react'
import { safeGetItem, safeSetItem } from '../utils/safeStorage'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

// Apply theme to DOM immediately (used both on init and on change)
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  const meta = document.getElementById('theme-color') as HTMLMetaElement | null
  if (meta) meta.content = theme === 'dark' ? '#1A1D23' : '#FFFFFF'
}

// Read stored theme (or default to 'light')
function getStoredTheme(): Theme {
  const stored = safeGetItem(STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

// Module-level listeners for useSyncExternalStore
let currentTheme: Theme = getStoredTheme()
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): Theme {
  return currentTheme
}

function setTheme(theme: Theme) {
  currentTheme = theme
  safeSetItem(STORAGE_KEY, theme)
  applyTheme(theme)
  listeners.forEach((cb) => cb())
}

/**
 * Hook to read and toggle the current theme.
 * Uses useSyncExternalStore for tear-free reads across components.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot)

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === 'light' ? 'dark' : 'light')
  }, [])

  return { theme, setTheme, toggleTheme }
}

/**
 * Initialize theme from localStorage and apply to DOM.
 * Call once at app startup (before first render ideally).
 */
export function initializeTheme() {
  const theme = getStoredTheme()
  currentTheme = theme
  applyTheme(theme)
}
