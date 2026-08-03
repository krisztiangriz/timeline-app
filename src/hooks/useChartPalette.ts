import { useState, useMemo } from 'react'
import { CHART_COLORS } from '../constants/colors'
import { useTheme } from './useTheme'
import { safeGetItem } from '../utils/safeStorage'
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

export function useChartPalette() {
  const [rawPalette] = useState<string[]>(readPalette)
  const { theme } = useTheme()

  const palette = useMemo(() => {
    if (theme === 'dark') return rawPalette.map((c) => lightenForDark(c))
    return rawPalette
  }, [rawPalette, theme])

  return { palette }
}
