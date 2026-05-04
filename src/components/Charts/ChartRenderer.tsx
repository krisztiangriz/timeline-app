import { useState, useEffect, useRef, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'
import {
  filterEntriesByScopes, filterFeedbacksByScopes,
  useEntryCount,
  useCandidatesByStatus, STATUS_COLORS,
  useFeedbackByMonth, useFeedbackSummary,
  useDimensionDistribution,
  getColor,
} from '../../hooks/useChartData'
import type { ChartConfig, ChartScope, ChartDataSource, ChartType, TimelineEntry, Feedback, Page, Dimension } from '../../types'
import styles from './Charts.module.css'

// ---- Shared constants ----

function pieLabel({ name, percent }: { name?: string; percent?: number }) {
  return `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
}

function cellLegend(items: { name: string; color: string }[]) {
  return () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
      {items.map((item) => (
        <span key={item.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#485670' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
          {item.name}
        </span>
      ))}
    </div>
  )
}

function ChartContainer({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.clientWidth > 0 && el.clientHeight > 0) { setMounted(true); return }
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        requestAnimationFrame(() => requestAnimationFrame(() => { setMounted(true); ro.disconnect() }))
      }
    })
    ro.observe(el)
    const timeout = setTimeout(() => { setMounted(true); ro.disconnect() }, 200)
    return () => { ro.disconnect(); clearTimeout(timeout) }
  }, [])
  return <div ref={ref} className={className}>{mounted && children}</div>
}

const tooltipStyle: React.CSSProperties = {
  background: '#FFFFFF', borderRadius: 12, boxShadow: '0px 2px 8px #5E6E8C33',
  border: 'none', padding: '8px 12px', fontSize: 12, lineHeight: '20px', color: '#5E6E8C',
}
const tooltipLabelStyle: React.CSSProperties = { color: '#334055', fontWeight: 600, fontSize: 12 }
const FEEDBACK_COLORS: Record<string, string> = { Positive: '#45C9A1', Neutral: '#ECF1F9', Negative: '#FF6363' }
const FEEDBACK_NEUTRAL_STROKE = '#B8C5DB'
const FEEDBACK_TOOLTIP_ORDER: Record<string, number> = { Positive: 0, Neutral: 1, Negative: 2 }
const feedbackTooltipSorter = (a: { dataKey?: unknown }) => FEEDBACK_TOOLTIP_ORDER[String(a.dataKey)] ?? 9
const FALLBACK_COLOR = '#B8C5DB'

/** Use grey for single-series charts, color palette for 2+ series */
function getSeriesColor(index: number, total: number) {
  return total < 2 ? FALLBACK_COLOR : getColor(index, total)
}

const cursorStyle = { fill: '#ECF1F9', stroke: '#ECF1F9' }
const TP = { contentStyle: tooltipStyle, labelStyle: tooltipLabelStyle, cursor: cursorStyle }
const TPfb = { ...TP, itemSorter: feedbackTooltipSorter }
const axisStroke = '#B8C5DB'
const tickStyle = { fontSize: 10, fill: '#485670' }
const legendStyle: React.CSSProperties = { fontSize: 10, color: '#485670', paddingTop: 4 }

// ---- Exports for AddChartModal ----

export const DATA_SOURCE_LABELS: Record<string, string> = {
  'entry-count': 'Entry count',
  'feedback-sentiment': 'Feedback sentiment',
  'feedback-by-dimension': 'Feedback by dimension',
  'candidate-status': 'Candidate status',
}

export const VALID_CHART_TYPES: Record<ChartDataSource, ChartType[]> = {
  'entry-count': ['bar', 'line', 'area', 'pie'],
  'feedback-sentiment': ['bar', 'line', 'area', 'pie'],
  'feedback-by-dimension': ['bar', 'pie'],
  'candidate-status': ['bar'],
}

// ---- Shared props interface ----

export interface ChartRendererProps {
  config: ChartConfig
  monthCount?: 3 | 6 | 12
  entries: TimelineEntry[]
  feedbacks: Feedback[]
  pages: Page[]
  dimensions: Dimension[]
  containerClass?: string
}

// ---- Dispatcher ----

export function ChartRenderer(props: ChartRendererProps) {
  switch (props.config.dataSource) {
    case 'entry-count': return <EntryCountChart {...props} />
    case 'candidate-status': return <CandidateStatusChart {...props} />
    case 'feedback-sentiment': return <FeedbackSentimentChart {...props} />
    case 'feedback-by-dimension': return <FeedbackDimensionChart {...props} />
    default: return null
  }
}

// ---- Helper: scope-filtered data ----

function useScopedData(entries: TimelineEntry[], feedbacks: Feedback[], pages: Page[], scopes: ChartScope[]) {
  const scopedEntries = useMemo(() => filterEntriesByScopes(entries, scopes, pages), [entries, scopes, pages])
  const scopedFeedbacks = useMemo(() => filterFeedbacksByScopes(feedbacks, scopes, pages), [feedbacks, scopes, pages])
  return { scopedEntries, scopedFeedbacks }
}

function useContainerClass(config: ChartConfig, containerClass?: string) {
  return containerClass ?? (config.chartType === 'pie' ? styles.chartContainerPie : styles.chartContainer)
}

// ---- Per-source chart components ----

function EntryCountChart({ config, monthCount = 12, entries, pages, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? []
  const { scopedEntries } = useScopedData(entries, [], pages, scopes)
  const data = useEntryCount(scopedEntries, pages, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {chartType === 'pie' ? (
          <PieChart>
            <Pie data={data.summary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={pieLabel}>
              {data.summary.map((_: unknown, i: number) => <Cell key={i} fill={getColor(i, data.summary.length)} />)}
            </Pie>
            <Tooltip {...TP} />
            <Legend content={cellLegend(data.summary.map((s: { name: string }, i: number) => ({ name: s.name, color: getColor(i, data.summary.length) })))} />
          </PieChart>
        ) : (() => {
          const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart
          const total = data.keys.length
          return (
            <ChartComp data={data.data}>
              <XAxis dataKey="month" tick={tickStyle} stroke={axisStroke} interval="preserveStartEnd" />
              <Tooltip {...TP} />
              {total > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />}
              {data.keys.map((key, i) =>
                chartType === 'line' ? <Line key={key} type="monotone" dataKey={key} stroke={getSeriesColor(i, total)} strokeWidth={2} dot={false} />
                : chartType === 'area' ? <Area key={key} type="monotone" dataKey={key} stackId="s" fill={getSeriesColor(i, total)} stroke={getSeriesColor(i, total)} fillOpacity={0.6} />
                : <Bar key={key} dataKey={key} stackId="s" fill={getSeriesColor(i, total)} />
              )}
            </ChartComp>
          )
        })()}
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function CandidateStatusChart({ config, pages, containerClass }: ChartRendererProps) {
  const data = useCandidatesByStatus(pages)
  const cls = useContainerClass(config, containerClass)

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
          <Tooltip {...TP} />
          {data.length > 1 && <Legend content={cellLegend(data.map((s, i) => ({ name: s.name, color: STATUS_COLORS[s.name] ?? getSeriesColor(i, data.length) })))} />}
          <Bar dataKey="value">
            {data.map((s, i) => <Cell key={s.name || i} fill={STATUS_COLORS[s.name] ?? getSeriesColor(i, data.length)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function FeedbackSentimentChart({ config, monthCount = 12, feedbacks, pages, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? []
  const { scopedFeedbacks } = useScopedData([], feedbacks, pages, scopes)
  const byMonth = useFeedbackByMonth(scopedFeedbacks, monthCount)
  const summary = useFeedbackSummary(scopedFeedbacks, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {chartType === 'pie' ? (
          <PieChart>
            <Pie data={summary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={pieLabel}>
              {summary.map((s) => <Cell key={s.name} fill={FEEDBACK_COLORS[s.name] ?? FALLBACK_COLOR} />)}
            </Pie>
            <Tooltip {...TPfb} />
          </PieChart>
        ) : (() => {
          const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart
          return (
            <ChartComp data={byMonth}>
              <XAxis dataKey="month" tick={tickStyle} stroke={axisStroke} interval="preserveStartEnd" />
              <Tooltip {...TPfb} />
              {chartType === 'line' ? (
                <>
                  <Line type="monotone" dataKey="Positive" stroke={FEEDBACK_COLORS.Positive} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Neutral" stroke={FEEDBACK_NEUTRAL_STROKE} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Negative" stroke={FEEDBACK_COLORS.Negative} strokeWidth={2} dot={false} />
                </>
              ) : chartType === 'area' ? (
                <>
                  <Area type="monotone" dataKey="Negative" stackId="fb" fill={FEEDBACK_COLORS.Negative} stroke={FEEDBACK_COLORS.Negative} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Neutral" stackId="fb" fill={FEEDBACK_COLORS.Neutral} stroke={FEEDBACK_NEUTRAL_STROKE} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Positive" stackId="fb" fill={FEEDBACK_COLORS.Positive} stroke={FEEDBACK_COLORS.Positive} fillOpacity={0.6} />
                </>
              ) : (
                <>
                  <Bar dataKey="Negative" stackId="fb" fill={FEEDBACK_COLORS.Negative} />
                  <Bar dataKey="Neutral" stackId="fb" fill={FEEDBACK_COLORS.Neutral} />
                  <Bar dataKey="Positive" stackId="fb" fill={FEEDBACK_COLORS.Positive} />
                </>
              )}
            </ChartComp>
          )
        })()}
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function FeedbackDimensionChart({ config, monthCount = 12, feedbacks, pages, dimensions, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? []
  const { scopedFeedbacks } = useScopedData([], feedbacks, pages, scopes)
  const dimMap = useMemo(() => new Map(dimensions.map((d) => [d.id!, d.name])), [dimensions])
  const data = useDimensionDistribution(scopedFeedbacks, pages, dimMap, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {data.perChild ? (
          chartType === 'pie' ? (() => {
            const agg = new Map<string, number>()
            for (const row of data.data) { for (const k of data.keys) { agg.set(k, (agg.get(k) || 0) + Number(row[k])) } }
            const pieData = [...agg.entries()].map(([name, value]) => ({ name, value })).filter((s) => s.value > 0)
            return (
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={pieLabel}>
                  {pieData.map((_: unknown, i: number) => <Cell key={i} fill={getColor(i, pieData.length)} />)}
                </Pie>
                <Tooltip {...TP} />
                <Legend content={cellLegend(pieData.map((s, i) => ({ name: s.name, color: getColor(i, pieData.length) })))} />
              </PieChart>
            )
          })() : (
            <BarChart data={data.data}>
              <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
              <Tooltip {...TP} />
              {data.keys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />}
              {data.keys.map((key, i) => <Bar key={key} dataKey={key} fill={getSeriesColor(i, data.keys.length)} />)}
            </BarChart>
          )
        ) : (
          chartType === 'pie' ? (
            <PieChart>
              <Pie data={data.summary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={pieLabel}>
                {data.summary.map((_: unknown, i: number) => <Cell key={i} fill={getColor(i, data.summary.length)} />)}
              </Pie>
              <Tooltip {...TP} />
              <Legend content={cellLegend(data.summary.map((s, i) => ({ name: s.name, color: getColor(i, data.summary.length) })))} />
            </PieChart>
          ) : (
            <BarChart data={data.summary} layout="vertical">
              <XAxis type="number" allowDecimals={false} tick={tickStyle} stroke={axisStroke} interval="preserveStartEnd" />
              <YAxis type="category" dataKey="name" tick={tickStyle} stroke={axisStroke} width={120} />
              <Tooltip {...TP} />
              {data.summary.length > 1 && <Legend content={cellLegend(data.summary.map((s, i) => ({ name: s.name, color: getSeriesColor(i, data.summary.length) })))} />}
              <Bar dataKey="value">
                {data.summary.map((_: unknown, i: number) => <Cell key={i} fill={getSeriesColor(i, data.summary.length)} />)}
              </Bar>
            </BarChart>
          )
        )}
      </ResponsiveContainer>
    </ChartContainer>
  )
}
