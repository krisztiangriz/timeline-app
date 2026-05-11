import { useState, useCallback } from 'react'
import { CHART_COLORS } from '../constants/colors'

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
    const stored = localStorage.getItem(LS_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* localStorage unavailable or corrupt */ }
  return CHART_COLORS
}

function writePalette(palette: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(palette)) } catch { /* ignore */ }
}

function clearPalette() {
  try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
}

/**
 * Hook for reading/writing a custom chart palette from localStorage.
 * Falls back to CHART_COLORS defaults.
 */
export function useChartPalette() {
  const [palette, setPaletteState] = useState<string[]>(readPalette)

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
