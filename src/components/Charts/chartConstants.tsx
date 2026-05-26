import { getColor } from '../../constants/colors'
import type { ChartScope, ChartDataSource, ChartType } from '../../types'

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
export const legendStyle: React.CSSProperties = { fontSize: 10, color: 'var(--color-text-body)', paddingTop: 4 }

// ---- Exports for AddChartModal ----

export const DATA_SOURCE_LABELS: Record<string, string> = {
  'entry-count': 'Entry count',
  'entry-by-weekday': 'Entry by weekday',
  'property-distribution': 'Property distribution',
  'page-count': 'Page count',
  'feedback-by-type': 'Feedback by type',
  'feedback-by-dimension': 'Feedback by dimension',
  'feedback-over-time': 'Feedback over time',
  'feedback-per-page': 'Feedback per page',
}

export const VALID_CHART_TYPES: Record<ChartDataSource, ChartType[]> = {
  'entry-count': ['bar', 'line', 'area', 'pie'],
  'entry-by-weekday': ['bar', 'area'],
  'property-distribution': ['bar', 'pie'],
  'page-count': ['bar', 'line', 'area'],
  'feedback-by-type': ['bar', 'pie'],
  'feedback-by-dimension': ['bar', 'pie'],
  'feedback-over-time': ['bar', 'line', 'area'],
  'feedback-per-page': ['bar', 'pie'],
}
