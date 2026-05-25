import { useState, useEffect, useRef, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'
import {
  filterEntriesByScopes,
  useEntryCount,
  useEntryByWeekday,
  usePagesByProperty,
  usePageCount,
} from '../../hooks/useChartData'
import { getColor } from '../../constants/colors'
import { useChartPalette } from '../../hooks/useChartPalette'
import { EmptyState } from '../EmptyState/EmptyState'
import type { ChartConfig, ChartScope, ChartDataSource, ChartType, TimelineEntry, Page } from '../../types'
import styles from './Charts.module.css'

// ---- Shared constants ----

const EMPTY_SCOPES: ChartScope[] = []

function cellLegend(items: { name: string; color: string }[]) {
  return () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
      {items.map((item) => (
        <span key={item.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-text-body)' }}>
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
  background: 'var(--color-surface)', borderRadius: 12, boxShadow: '0px 2px 8px var(--color-shadow)',
  border: 'none', padding: '8px 12px', fontSize: 12, lineHeight: '20px',
}
const tooltipLabelStyle: React.CSSProperties = { color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 12 }
const FALLBACK_COLOR = 'var(--color-text-placeholder)'

/** Use grey for single-series charts, color palette for 2+ series */
function getSeriesColor(index: number, total: number, palette: string[]) {
  return total < 2 ? FALLBACK_COLOR : getColor(index, palette)
}

const cursorStyle = { fill: 'var(--color-border-light)', stroke: 'var(--color-border-light)' }
const TP = {
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
const axisStroke = 'var(--color-border)'
const tickStyle = { fontSize: 10, fill: 'var(--color-text-body)' }
const legendStyle: React.CSSProperties = { fontSize: 10, color: 'var(--color-text-body)', paddingTop: 4 }

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

// ---- Shared props interface ----

import type { HubProperty, PagePropertyValue, Feedback } from '../../types'

export interface ChartRendererProps {
  config: ChartConfig
  monthCount?: 0 | 3 | 6 | 12
  entries: TimelineEntry[]
  pages: Page[]
  hubProperties: HubProperty[]
  feedbacks: Feedback[]
  propertyValues: PagePropertyValue[]
  containerClass?: string
}

// ---- Dispatcher ----

export function ChartRenderer(props: ChartRendererProps) {
  switch (props.config.dataSource) {
    case 'entry-count': return <EntryCountChart {...props} />
    case 'entry-by-weekday': return <EntryByWeekdayChart {...props} />
    case 'property-distribution': return <PropertyDistributionChart {...props} />
    case 'page-count': return <PageCountChart {...props} />
    case 'feedback-by-type': return <FeedbackByTypeChart {...props} />
    case 'feedback-by-dimension': return <FeedbackByDimensionChart {...props} />
    case 'feedback-over-time': return <FeedbackOverTimeChart {...props} />
    case 'feedback-per-page': return <FeedbackPerPageChart {...props} />
    default: return null
  }
}

// ---- Helper: scope-filtered data ----

function useScopedEntries(entries: TimelineEntry[], pages: Page[], scopes: ChartScope[]) {
  return useMemo(() => filterEntriesByScopes(entries, scopes, pages), [entries, scopes, pages])
}

function useContainerClass(config: ChartConfig, containerClass?: string) {
  return containerClass ?? (config.chartType === 'pie' ? styles.chartContainerPie : styles.chartContainer)
}

// ---- Donut chart with right-side labels ----

function DonutWithLabels({ data, colorFn, containerClass, tooltipProps }: {
  data: { name: string; value: number }[]
  colorFn: (i: number) => string
  containerClass: string
  tooltipProps?: Record<string, unknown>
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className={containerClass}>
      <div className={styles.pieLayout}>
        <PieChart width={200} height={200} className={styles.pieChartDonut}>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" isAnimationActive={false}>
            {data.map((_: unknown, i: number) => <Cell key={i} fill={colorFn(i)} />)}
          </Pie>
          <Tooltip {...(tooltipProps ?? TP)} />
        </PieChart>
        <div className={styles.pieLabels}>
          {data.map((item, i) => (
            <span key={item.name} className={styles.pieLabelItem}>
              <span className={styles.pieLabelDot} style={{ background: colorFn(i) }} />
              {item.name} {total > 0 ? Math.round(item.value / total * 100) : 0}%
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Per-source chart components ----

function EntryCountChart({ config, monthCount = 12, entries, pages, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedEntries = useScopedEntries(entries, pages, scopes)
  const data = useEntryCount(scopedEntries, pages, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config
  const { palette } = useChartPalette()

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

function EntryByWeekdayChart({ config, monthCount = 12, entries, pages, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedEntries = useScopedEntries(entries, pages, scopes)
  const data = useEntryByWeekday(scopedEntries, pages, scopes, monthCount)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config
  const { palette } = useChartPalette()

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

function PropertyDistributionChart({ config, pages, hubProperties, propertyValues, containerClass }: ChartRendererProps) {
  const candidateHub = pages.find((p) => p.role === 'candidate-hub')
  const { palette } = useChartPalette()

  const statusProperty = config.propertyId
    ? hubProperties.find((p) => p.id === config.propertyId)
    : hubProperties.find((p) => p.hubId === candidateHub?.id && (!p.scope || p.scope === 'page'))

  const data = usePagesByProperty(pages, statusProperty, propertyValues)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config

  if (!statusProperty) {
    return (
      <ChartContainer className={cls}>
        <EmptyState compact message="No property selected" />
    </ChartContainer>
    )
  }

  if (chartType === 'pie') {
    return (
      <DonutWithLabels
        data={data}
        colorFn={(i) => data[i]?.color ?? getColor(i, palette)}
        containerClass={cls}
        tooltipProps={TP}
      />
    )
  }

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
          <Tooltip {...TP} />
          {data.length > 1 && <Legend content={cellLegend(data.map((s) => ({ name: s.name, color: s.color })))} />}
          <Bar dataKey="value" name="Count">
            {data.map((s, i) => <Cell key={s.name || i} fill={s.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// ---- Feedback chart helpers ----

function useScopedFeedbacks(allFeedbacks: Feedback[], pages: Page[], scopes: ChartScope[]) {
  return useMemo(() => {
    if (scopes.length === 0) return allFeedbacks
    const pageIds = new Set<number>()
    for (const s of scopes) {
      if (s.type === 'page') pageIds.add(s.pageId)
      if (s.type === 'hub') {
        for (const p of pages) { if (p.parentId === s.hubId) pageIds.add(p.id!) }
      }
    }
    return pageIds.size > 0 ? allFeedbacks.filter((f) => pageIds.has(f.subjectId)) : allFeedbacks
  }, [allFeedbacks, pages, scopes])
}

function useHubFromScopes(pages: Page[], scopes: ChartScope[]) {
  return useMemo(() => {
    for (const s of scopes) {
      if (s.type === 'hub') return pages.find((p) => p.id === s.hubId)
      if (s.type === 'page') {
        const page = pages.find((p) => p.id === s.pageId)
        if (page?.type === 'hub') return page
        if (page?.parentId) return pages.find((p) => p.id === page.parentId)
      }
    }
    return undefined
  }, [pages, scopes])
}

// ---- Feedback by type (1st property) ----

function FeedbackByTypeChart({ config, pages, hubProperties, feedbacks, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedFeedbacks = useScopedFeedbacks(feedbacks, pages, scopes)
  const hub = useHubFromScopes(pages, scopes)
  const typeProp = hubProperties.find((p) => p.hubId === hub?.id && p.scope === 'feedback')
  const cls = useContainerClass(config, containerClass)

  const data = useMemo(() => {
    if (!typeProp) return []
    const counts = new Map<string, number>()
    for (const f of scopedFeedbacks) counts.set(f.type, (counts.get(f.type) || 0) + 1)
    return typeProp.options
      .map((opt) => ({ name: opt.label, value: counts.get(opt.value) || 0, color: opt.color ?? '#7B8FA6' }))
      .filter((d) => d.value > 0)
  }, [scopedFeedbacks, typeProp])

  if (data.length === 0) return <ChartContainer className={cls}><EmptyState compact message="No feedback data" /></ChartContainer>

  if (config.chartType === 'pie') {
    return <DonutWithLabels data={data} colorFn={(i) => data[i]?.color ?? '#7B8FA6'} containerClass={cls} tooltipProps={TP} />
  }

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
          <Tooltip {...TP} />
          <Bar dataKey="value" name="Feedback">
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// ---- Feedback by dimension (2nd property) ----

function FeedbackByDimensionChart({ config, pages, hubProperties, feedbacks, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedFeedbacks = useScopedFeedbacks(feedbacks, pages, scopes)
  const hub = useHubFromScopes(pages, scopes)
  const fbProps = hubProperties.filter((p) => p.hubId === hub?.id && p.scope === 'feedback')
  const dimProp = fbProps[1] // second feedback property
  const cls = useContainerClass(config, containerClass)

  const data = useMemo(() => {
    if (!dimProp) return []
    const counts = new Map<string, number>()
    for (const f of scopedFeedbacks) {
      if (f.dimensionId) counts.set(String(f.dimensionId), (counts.get(String(f.dimensionId)) || 0) + 1)
    }
    return dimProp.options
      .map((opt) => ({ name: opt.label, value: counts.get(opt.value) || 0, color: opt.color ?? '#7B8FA6' }))
      .filter((d) => d.value > 0)
  }, [scopedFeedbacks, dimProp])

  if (data.length === 0) return <ChartContainer className={cls}><EmptyState compact message="No feedback data" /></ChartContainer>

  if (config.chartType === 'pie') {
    return <DonutWithLabels data={data} colorFn={(i) => data[i]?.color ?? '#7B8FA6'} containerClass={cls} tooltipProps={TP} />
  }

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
          <Tooltip {...TP} />
          <Bar dataKey="value" name="Feedback">
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// ---- Feedback over time (trend, broken down by 1st property) ----

function FeedbackOverTimeChart({ config, monthCount = 12, pages, hubProperties, feedbacks, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedFeedbacks = useScopedFeedbacks(feedbacks, pages, scopes)
  const hub = useHubFromScopes(pages, scopes)
  const typeProp = hubProperties.find((p) => p.hubId === hub?.id && p.scope === 'feedback')
  const cls = useContainerClass(config, containerClass)
  const { palette } = useChartPalette()

  const { data, keys, colorMap } = useMemo(() => {
    if (!typeProp) return { data: [], keys: [] as string[], colorMap: new Map<string, string>() }

    const now = new Date()
    let count: number = monthCount
    if (count === 0) {
      if (feedbacks.length > 0) {
        const earliest = feedbacks.reduce((min, f) => {
          const d = new Date(f.createdAt)
          return d < min ? d : min
        }, now)
        count = Math.max((now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1, 1)
      } else {
        count = 24
      }
    }

    const months: string[] = []
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const keys = typeProp.options.map((o) => o.label)
    const colorMap = new Map(typeProp.options.map((o, i) => [o.label, o.color ?? getColor(i, palette)]))
    const valueToLabel = new Map(typeProp.options.map((o) => [o.value, o.label]))

    const data = months.map((m) => {
      const row: Record<string, string | number> = { month: `${m.slice(2, 4)}${m.slice(5)}` }
      for (const k of keys) row[k] = 0
      return row
    })

    for (const f of scopedFeedbacks) {
      const d = new Date(f.createdAt)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const idx = months.indexOf(m)
      if (idx === -1) continue
      const label = valueToLabel.get(f.type)
      if (label) data[idx][label] = (Number(data[idx][label]) || 0) + 1
    }

    return { data, keys, colorMap }
  }, [scopedFeedbacks, feedbacks, typeProp, monthCount, palette])

  if (keys.length === 0) return <ChartContainer className={cls}><EmptyState compact message="No feedback properties configured" /></ChartContainer>

  const { chartType } = config

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {(() => {
          const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart
          return (
            <ChartComp data={data}>
              <XAxis dataKey="month" tick={tickStyle} stroke={axisStroke} interval="preserveStartEnd" />
              <Tooltip {...TP} />
              {keys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />}
              {chartType === 'line' ? (
                keys.map((key) => <Line key={key} type="monotone" dataKey={key} stroke={colorMap.get(key) ?? FALLBACK_COLOR} strokeWidth={2} dot={false} />)
              ) : chartType === 'area' ? (
                keys.map((key) => <Area key={key} type="monotone" dataKey={key} stackId="fb" fill={colorMap.get(key) ?? FALLBACK_COLOR} stroke={colorMap.get(key) ?? FALLBACK_COLOR} fillOpacity={0.6} />)
              ) : (
                keys.map((key) => <Bar key={key} dataKey={key} stackId="fb" fill={colorMap.get(key) ?? FALLBACK_COLOR} />)
              )}
            </ChartComp>
          )
        })()}
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// ---- Feedback per page ----

function FeedbackPerPageChart({ config, pages, hubProperties, feedbacks, containerClass }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedFeedbacks = useScopedFeedbacks(feedbacks, pages, scopes)
  const hub = useHubFromScopes(pages, scopes)
  const typeProp = hubProperties.find((p) => p.hubId === hub?.id && p.scope === 'feedback')
  const cls = useContainerClass(config, containerClass)
  const { palette } = useChartPalette()

  const { data, keys, colorMap } = useMemo(() => {
    if (!typeProp) {
      // Fallback: no feedback property, single total per page
      const counts = new Map<number, number>()
      for (const f of scopedFeedbacks) counts.set(f.subjectId, (counts.get(f.subjectId) || 0) + 1)
      const data: Record<string, string | number>[] = [...counts.entries()]
        .map(([pageId, count]) => {
          const page = pages.find((p) => p.id === pageId)
          return { name: page?.name ?? `Page ${pageId}`, Total: count } as Record<string, string | number>
        })
        .filter((d) => (d.Total as number) > 0)
        .sort((a, b) => (b.Total as number) - (a.Total as number))
      return { data, keys: ['Total'], colorMap: new Map<string, string>() }
    }

    const valueToLabel = new Map(typeProp.options.map((o) => [o.value, o.label]))
    const colorMap = new Map(typeProp.options.map((o, i) => [o.label, o.color ?? getColor(i, palette)]))
    const keys = typeProp.options.map((o) => o.label)

    const pageMap = new Map<number, Record<string, number>>()
    for (const f of scopedFeedbacks) {
      if (!pageMap.has(f.subjectId)) {
        const row: Record<string, number> = {}
        for (const k of keys) row[k] = 0
        pageMap.set(f.subjectId, row)
      }
      const label = valueToLabel.get(f.type)
      if (label) pageMap.get(f.subjectId)![label]++
    }

    const data: Record<string, string | number>[] = [...pageMap.entries()]
      .map(([pageId, counts]) => {
        const page = pages.find((p) => p.id === pageId)
        return { name: page?.name ?? `Page ${pageId}`, ...counts } as Record<string, string | number>
      })
      .sort((a, b) => {
        const totalA = keys.reduce((s, k) => s + (Number(a[k]) || 0), 0)
        const totalB = keys.reduce((s, k) => s + (Number(b[k]) || 0), 0)
        return totalB - totalA
      })

    return { data, keys, colorMap }
  }, [scopedFeedbacks, pages, typeProp, palette])

  if (data.length === 0) return <ChartContainer className={cls}><EmptyState compact message="No feedback data" /></ChartContainer>

  if (config.chartType === 'pie') {
    const pieData = data.map((d) => ({
      name: String(d.name),
      value: keys.reduce((s, k) => s + (Number(d[k]) || 0), 0),
    }))
    return <DonutWithLabels data={pieData} colorFn={(i) => getColor(i, palette)} containerClass={cls} tooltipProps={TP} />
  }

  return (
    <ChartContainer className={cls}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
          <Tooltip {...TP} />
          {keys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />}
          {keys.map((key) => <Bar key={key} dataKey={key} stackId="fp" fill={colorMap.get(key) ?? FALLBACK_COLOR} />)}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function PageCountChart({ config, monthCount = 12, pages, containerClass }: ChartRendererProps) {
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
