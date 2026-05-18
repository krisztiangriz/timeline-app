import { useState, useCallback, useMemo } from 'react'
import { CHART_COLORS } from '../constants/colors'
import { useTheme } from './useTheme'
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/safeStorage'

const LS_KEY = 'chart-palette'

/** Curated palette options for color picking (accessible, ≥3:1 contrast) */
export const PALETTE_OPTIONS = [
  '#4A9AF5', '#3D87E0', '#2E6FC4', '#5BA8FF',
  '#3BB88E', '#2FA37A', '#258A66', '#4CC9A0',
  '#9B7CE0', '#8563CC', '#6E4DB5', '#B08EF0',
  '#E8923B', '#D47E28', '#C06A18', '#F0A050',
  '#3FAFB5', '#339AA0', '#28868C', '#50BFC5',
  '#7B8FA6', '#6B7F96', '#5A6E85', '#8EA2B8',
  '#E07090', '#CC5C7C', '#B84A6A', '#F080A0',
]

function readPalette(): string[] {
  try {
    const stored = safeGetItem(LS_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* parse error */ }
  return CHART_COLORS
}

function writePalette(palette: string[]) {
  safeSetItem(LS_KEY, JSON.stringify(palette))
}

function clearPalette() {
  safeRemoveItem(LS_KEY)
}

/** Convert hex color to HSL, boost lightness for dark mode, return hex */
function lightenForDark(hex: string, boost = 15): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0, s = 0
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const newL = Math.min(l + boost / 100, 0.85)
  // HSL → RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  let r2: number, g2: number, b2: number
  if (s === 0) { r2 = g2 = b2 = newL }
  else {
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s
    const p = 2 * newL - q
    r2 = hue2rgb(p, q, h + 1/3)
    g2 = hue2rgb(p, q, h)
    b2 = hue2rgb(p, q, h - 1/3)
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`
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
