import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'
import {
  useEntryCount,
  useEntryByWeekday,
  usePageCount,
} from '../../hooks/useChartData'
import { getColor } from '../../constants/colors'
import { getSeriesColor, FALLBACK_COLOR, TP, axisStroke, tickStyle, legendStyle } from './chartConstants'
import { useScopedEntries, useContainerClass, EMPTY_SCOPES } from './chartHooks'
import { ChartContainer, DonutWithLabels } from './ChartContainer'
import type { ChartRendererProps } from './ChartRenderer'

export function EntryCountChart({ config, monthCount = 12, entries, pages, containerClass, palette }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedEntries = useScopedEntries(entries, pages, scopes)
  const data = useEntryCount(scopedEntries, pages, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config

  return (
    <ChartContainer className={cls}>
      {chartType === 'pie' ? (
        <DonutWithLabels
          data={data.summary}
          colorFn={(i) => getColor(i, palette)}
          containerClass={cls}
          tooltipProps={TP}
        />
      ) : (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {(() => {
          const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart
          const total = data.keys.length
          return (
            <ChartComp data={data.data}>
              <XAxis dataKey="month" tick={tickStyle} stroke={axisStroke} interval="preserveStartEnd" />
              <Tooltip {...TP} />
              {total > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />}
              {data.keys.map((key, i) =>
                chartType === 'line' ? <Line key={key} type="monotone" dataKey={key} stroke={getSeriesColor(i, total, palette)} strokeWidth={2} dot={false} />
                : chartType === 'area' ? <Area key={key} type="monotone" dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} stroke={getSeriesColor(i, total, palette)} fillOpacity={0.6} />
                : <Bar key={key} dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} />
              )}
            </ChartComp>
          )
        })()}
      </ResponsiveContainer>
      )}
    </ChartContainer>
  )
}

export function EntryByWeekdayChart({ config, monthCount = 12, entries, pages, containerClass, palette }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedEntries = useScopedEntries(entries, pages, scopes)
  const data = useEntryByWeekday(scopedEntries, pages, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {(() => {
          const ChartComp = chartType === 'area' ? AreaChart : BarChart
          const total = data.keys.length
          return (
            <ChartComp data={data.data}>
              <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
              <Tooltip {...TP} />
              {total > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />}
              {data.keys.map((key, i) =>
                chartType === 'area'
                  ? <Area key={key} type="monotone" dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} stroke={getSeriesColor(i, total, palette)} fillOpacity={0.6} />
                  : <Bar key={key} dataKey={key} stackId="s" fill={getSeriesColor(i, total, palette)} />
              )}
            </ChartComp>
          )
        })()}
      </ResponsiveContainer>
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
