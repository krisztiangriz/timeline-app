import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts'
import {
  useEntryCount,
  useEntryByWeekday,
  usePageCount,
} from '../../hooks/useChartData'
import { getColor } from '../../constants/colors'
import { getSeriesColor, FALLBACK_COLOR, TP, axisStroke, tickStyle } from './chartConstants'
import { useScopedEntries, useContainerClass, EMPTY_SCOPES } from './chartHooks'
import { ChartContainer, DonutWithLabels, InteractiveLegend } from './ChartContainer'
import { useSeriesFilter } from './useSeriesFilter'
import type { ChartRendererProps } from './ChartRenderer'

export function EntryCountChart({ config, monthCount = 12, entries, pages, containerClass, palette }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedEntries = useScopedEntries(entries, pages, scopes)
  const data = useEntryCount(scopedEntries, pages, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config
  const { toggle, opacity, isActive } = useSeriesFilter(data.keys)
  const total = data.keys.length

  return (
    <ChartContainer className={cls}>
      {chartType === 'pie' ? (
        <DonutWithLabels
          data={data.summary}
          colorFn={(i) => getColor(i, palette)}
          containerClass={cls}
          tooltipProps={TP}
          isActive={total > 1 ? isActive : undefined}
          onToggle={total > 1 ? toggle : undefined}
        />
      ) : (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {(() => {
          const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart
          return (
            <ChartComp data={data.data}>
              <XAxis dataKey="month" tick={tickStyle} stroke={axisStroke} interval="preserveStartEnd" />
              <Tooltip {...TP} />
              {data.keys.map((key, i) =>
                chartType === 'line' ? <Line key={key} type="monotone" dataKey={key} stroke={getSeriesColor(i, total, palette)} strokeWidth={2} dot={false} strokeOpacity={opacity(key)} />
                : chartType === 'area' ? <Area key={key} type="monotone" dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} stroke={getSeriesColor(i, total, palette)} fillOpacity={opacity(key) * 0.6} strokeOpacity={opacity(key)} />
                : <Bar key={key} dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} fillOpacity={opacity(key)} />
              )}
            </ChartComp>
          )
        })()}
      </ResponsiveContainer>
      )}
      {total > 1 && <InteractiveLegend items={data.keys.map((key, i) => ({ name: key, color: getSeriesColor(i, total, palette) }))} isActive={isActive} onToggle={toggle} />}
    </ChartContainer>
  )
}

export function EntryByWeekdayChart({ config, monthCount = 12, entries, pages, containerClass, palette }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedEntries = useScopedEntries(entries, pages, scopes)
  const data = useEntryByWeekday(scopedEntries, pages, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config
  const { toggle, opacity, isActive } = useSeriesFilter(data.keys)
  const total = data.keys.length

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {(() => {
          const ChartComp = chartType === 'area' ? AreaChart : BarChart
          return (
            <ChartComp data={data.data}>
              <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
              <Tooltip {...TP} />
              {data.keys.map((key, i) =>
                chartType === 'area'
                  ? <Area key={key} type="monotone" dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} stroke={getSeriesColor(i, total, palette)} fillOpacity={opacity(key) * 0.6} strokeOpacity={opacity(key)} />
                  : <Bar key={key} dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} fillOpacity={opacity(key)} />
              )}
            </ChartComp>
          )
        })()}
      </ResponsiveContainer>
      {total > 1 && <InteractiveLegend items={data.keys.map((key, i) => ({ name: key, color: getSeriesColor(i, total, palette) }))} isActive={isActive} onToggle={toggle} />}
    </ChartContainer>
  )
}

export function PageCountChart({ config, monthCount = 12, pages, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const data = usePageCount(pages, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {(() => {
          const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart
          return (
            <ChartComp data={data.data}>
              <XAxis dataKey="month" tick={tickStyle} stroke={axisStroke} interval="preserveStartEnd" />
              <Tooltip {...TP} />
              {chartType === 'line'
                ? <Line type="monotone" dataKey="count" name="Pages" stroke={FALLBACK_COLOR} strokeWidth={2} dot={false} />
                : chartType === 'area'
                ? <Area type="monotone" dataKey="count" name="Pages" fill={FALLBACK_COLOR} stroke={FALLBACK_COLOR} fillOpacity={0.6} />
                : <Bar dataKey="count" name="Pages" fill={FALLBACK_COLOR} />
              }
            </ChartComp>
          )
        })()}
      </ResponsiveContainer>
    </ChartContainer>
  )
}
