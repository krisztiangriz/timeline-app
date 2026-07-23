import { useState, useCallback, useMemo } from 'react'
import { CHART_COLORS } from '../constants/colors'
import { useTheme } from './useTheme'
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/safeStorage'
import { lightenForDark } from '../utils/colorUtils'

const LS_KEY = 'chart-palette'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function readPalette(): string[] {
  try {
    const stored = safeGetItem(LS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.every((c) => typeof c === 'string' && HEX_COLOR_RE.test(c))) {
        return parsed
      }
    }
  } catch { /* parse error */ }
  return CHART_COLORS
}

function writePalette(palette: string[]) {
  safeSetItem(LS_KEY, JSON.stringify(palette))
}

function clearPalette() {
  safeRemoveItem(LS_KEY)
}

/**
 * Hook for reading/writing a custom chart palette from localStorage.
 * Falls back to CHART_COLORS defaults.
 * In dark mode, auto-adjusts palette lightness for contrast.
 */
export function useChartPalette() {
  const [rawPalette, setPaletteState] = useState<string[]>(readPalette)
  const { theme } = useTheme()

  const palette = useMemo(() => {
    if (theme === 'dark') return rawPalette.map((c) => lightenForDark(c))
    return rawPalette
  }, [rawPalette, theme])

  const updateColor = useCallback((index: number, color: string) => {
    setPaletteState((prev) => {
      const next = [...prev]
      next[index] = color
      writePalette(next)
      return next
    })
  }, [])

  const resetPalette = useCallback(() => {
    setPaletteState(CHART_COLORS)
    clearPalette()
  }, [])

  return { palette, updateColor, resetPalette }
}
