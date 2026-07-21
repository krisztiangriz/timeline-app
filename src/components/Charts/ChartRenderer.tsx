import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Cell,
} from 'recharts'
import { useUnifiedChartData } from '../../hooks/useChartData'
import { getSeriesColor, TP, axisStroke, tickStyle } from './chartConstants'
import { ChartContainer, DonutWithLabels, InteractiveLegend } from './ChartContainer'
import { useSeriesFilter } from './useSeriesFilter'
import { getColor } from '../../constants/colors'
import { EmptyState } from '../EmptyState/EmptyState'
import type { ChartConfig, TimelineEntry, Page, HubProperty, PagePropertyValue, RegexPattern } from '../../types'
import styles from './Charts.module.css'

export { SOURCE_LABELS, VALID_GROUPINGS, CHART_TYPES_FOR_GROUPING, GROUPING_LABELS } from './chartConstants'

export interface ChartRendererProps {
  config: ChartConfig
  monthCount?: 0 | 3 | 6 | 12
  entries: TimelineEntry[]
  pages: Page[]
  hubProperties: HubProperty[]
  propertyValues: PagePropertyValue[]
  regexPatterns: RegexPattern[]
  containerClass?: string
  palette: string[]
}

export function ChartRenderer({ config, monthCount = 12, entries, pages, hubProperties, propertyValues, regexPatterns, containerClass, palette }: ChartRendererProps) {
  const result = useUnifiedChartData(config, entries, pages, hubProperties, propertyValues, regexPatterns, monthCount)
  const { toggle, opacity, isActive } = useSeriesFilter(result.summary ? result.summary.map(s => s.name) : result.keys)
  const cls = containerClass ?? (config.chartType === 'pie' ? styles.chartContainerPie : styles.chartContainer)

  if (config.source === 'property' && !config.propertyId) {
    return (
      <ChartContainer className={cls}>
        <EmptyState compact message="No property selected" />
      </ChartContainer>
    )
  }

  // Pie/donut for property-value grouping
  if (config.chartType === 'pie' && result.summary) {
    return (
      <DonutWithLabels
        data={result.summary}
        colorFn={(i) => result.summary![i]?.color ?? getColor(i, palette)}
        containerClass={cls}
        tooltipProps={TP}
        isActive={result.summary.length > 1 ? isActive : undefined}
        onToggle={result.summary.length > 1 ? toggle : undefined}
      />
    )
  }

  // Bar chart with per-item colors (property distribution as bar)
  if (config.source === 'property' && config.chartType === 'bar' && result.summary) {
    const total = result.summary.length
    return (
      <>
        <ChartContainer className={cls}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={result.summary}>
              <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
              <Tooltip {...TP} />
              <Bar dataKey="value" name="Count">
                {result.summary.map((s, i) => <Cell key={s.name || i} fill={s.color ?? getColor(i, palette)} fillOpacity={opacity(s.name)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        {total > 1 && <InteractiveLegend items={result.summary.map(d => ({ name: d.name, color: d.color ?? getColor(result.summary!.indexOf(d), palette) }))} isActive={isActive} onToggle={toggle} />}
      </>
    )
  }

  // Generic time-series / categorical chart
  const { chartType } = config
  const total = result.keys.length
  const xInterval = result.xKey === 'name' ? 0 : 'preserveStartEnd'

  return (
    <>
      <ChartContainer className={cls}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {(() => {
            const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart
            return (
              <ChartComp data={result.data}>
                <XAxis dataKey={result.xKey} tick={tickStyle} stroke={axisStroke} interval={xInterval} />
                <Tooltip {...TP} />
                {result.keys.map((key, i) =>
                  chartType === 'line' ? <Line key={key} type="monotone" dataKey={key} stroke={getSeriesColor(i, total, palette)} strokeWidth={2} dot={false} strokeOpacity={opacity(key)} />
                  : chartType === 'area' ? <Area key={key} type="monotone" dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} stroke={getSeriesColor(i, total, palette)} fillOpacity={opacity(key) * 0.6} strokeOpacity={opacity(key)} />
                  : <Bar key={key} dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} fillOpacity={opacity(key)} />
                )}
              </ChartComp>
            )
          })()}
        </ResponsiveContainer>
      </ChartContainer>
      {total > 1 && <InteractiveLegend items={result.keys.map((key, i) => ({ name: key, color: getSeriesColor(i, total, palette) }))} isActive={isActive} onToggle={toggle} />}
    </>
  )
}
