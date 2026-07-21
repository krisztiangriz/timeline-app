import { getColor } from '../../constants/colors'
import type { ChartScope, ChartSource, ChartGrouping, ChartType } from '../../types'

// ---- Shared constants ----

export const EMPTY_SCOPES: ChartScope[] = []

export const tooltipStyle: React.CSSProperties = {
  background: 'var(--color-surface)', borderRadius: 12, boxShadow: '0px 2px 8px var(--color-shadow)',
  border: 'none', padding: '8px 12px', fontSize: 12, lineHeight: '20px',
}
export const tooltipLabelStyle: React.CSSProperties = { color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 12 }
export const FALLBACK_COLOR = 'var(--color-text-placeholder)'

/** Use grey for single-series charts, color palette for 2+ series */
export function getSeriesColor(index: number, total: number, palette: string[]) {
  return total < 2 ? FALLBACK_COLOR : getColor(index, palette)
}

export const cursorStyle = { fill: 'var(--color-border-light)', stroke: 'var(--color-border-light)' }
export const TP = {
  contentStyle: tooltipStyle,
  labelStyle: tooltipLabelStyle,
  cursor: cursorStyle,
  wrapperStyle: { zIndex: 1000 },
  separator: '',
  formatter: (value: unknown, name: unknown, item: { color?: string; payload?: { color?: string } }) => {
    const color = item.payload?.color || item.color || 'var(--color-text-secondary)'
    return [<span key="v" style={{ color }}>{String(name)}: {String(value)}</span>, '']
  },
}
export const axisStroke = 'var(--color-border)'
export const tickStyle = { fontSize: 10, fill: 'var(--color-text-body)' }


// ---- Source / grouping configuration ----

export const VALID_GROUPINGS: Record<ChartSource, ChartGrouping[]> = {
  regex:    ['month', 'weekday'],
  entries:  ['month', 'weekday'],
  pages:    ['month'],
}

export const CHART_TYPES_FOR_GROUPING: Record<ChartGrouping, ChartType[]> = {
  month:            ['bar', 'line', 'area'],
  weekday:          ['bar', 'area'],
}

export const SOURCE_LABELS: Record<ChartSource, string> = {
  regex:    'Regex pattern',
  entries:  'Timeline entries',
  pages:    'Pages',
}

export const GROUPING_LABELS: Record<ChartGrouping, string> = {
  month:            'By month',
  weekday:          'By weekday',
}
