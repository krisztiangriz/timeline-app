import { useState, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts'
import { useUnifiedChartData } from '../../hooks/useChartData'
import { getSeriesColor, FALLBACK_COLOR, TP, axisStroke, tickStyle } from './chartConstants'
import { ChartContainer, DonutWithLabels, InteractiveLegend } from './ChartContainer'
import { getColor } from '../../constants/colors'
import type { ChartConfig, TimelineEntry, Page, EntryTag } from '../../types'
import styles from './Charts.module.css'

function useSeriesFilter(keys: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const validSelected = useMemo(() => {
    const keySet = new Set(keys)
    const filtered = new Set([...selected].filter(k => keySet.has(k)))
    return filtered.size === selected.size ? selected : filtered
  }, [keys, selected])

  const toggle = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const opacity = useCallback((key: string) =>
    validSelected.size === 0 ? 1 : validSelected.has(key) ? 1 : 0.25
  , [validSelected])

  const isActive = useCallback((key: string) =>
    validSelected.size === 0 ? true : validSelected.has(key)
  , [validSelected])

  return { toggle, opacity, isActive }
}


interface ChartRendererProps {
  config: ChartConfig
  monthCount?: 0 | 3 | 6 | 12
  entries: TimelineEntry[]
  pages: Page[]
  entryTags: EntryTag[]
  containerClass?: string
  palette: string[]
  onSeriesColorChange?: (key: string, color: string) => void
}

export function ChartRenderer({ config, monthCount = 12, entries, pages, entryTags, containerClass, palette, onSeriesColorChange }: ChartRendererProps) {
  const result = useUnifiedChartData(config, entries, pages, entryTags, monthCount)
  const { toggle, opacity, isActive } = useSeriesFilter(result.summary ? result.summary.map(s => s.name) : result.keys)
  const cls = containerClass ?? (config.chartType === 'pie' ? styles.chartContainerPie : styles.chartContainer)

  function getKeyColor(key: string, i: number, total: number): string {
    if (config.seriesColors?.[key]) return config.seriesColors[key]
    if (config.source === 'classify' && key === 'Work') return FALLBACK_COLOR
    return getSeriesColor(i, total, palette)
  }

  // Pie/donut
  if (config.chartType === 'pie' && result.summary) {
    return (
      <DonutWithLabels
        data={result.summary}
        colorFn={(i) => {
          const key = result.summary![i]?.name
          if (key && config.seriesColors?.[key]) return config.seriesColors[key]
          return result.summary![i]?.color ?? getColor(i, palette)
        }}
        containerClass={cls}
        tooltipProps={TP}
        isActive={result.summary.length > 1 ? isActive : undefined}
        onToggle={result.summary.length > 1 ? toggle : undefined}
        onColorChange={result.summary.length > 1 ? onSeriesColorChange : undefined}
        items={result.summary}
      />
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
                  chartType === 'line' ? <Line key={key} type="monotone" dataKey={key} stroke={getKeyColor(key, i, total)} strokeWidth={2} dot={false} strokeOpacity={opacity(key)} />
                  : chartType === 'area' ? <Area key={key} type="monotone" dataKey={key} stackId="s" fill={getKeyColor(key, i, total)} stroke={getKeyColor(key, i, total)} fillOpacity={opacity(key) * 0.6} strokeOpacity={opacity(key)} />
                  : <Bar key={key} dataKey={key} stackId="s" fill={getKeyColor(key, i, total)} fillOpacity={opacity(key)} />
                )}
              </ChartComp>
            )
          })()}
        </ResponsiveContainer>
      </ChartContainer>
      {total > 1 && <InteractiveLegend items={result.keys.map((key, i) => ({ name: key, color: getKeyColor(key, i, total) }))} isActive={isActive} onToggle={toggle} onColorChange={onSeriesColorChange} />}
    </>
  )
}
