import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'
import { getColor } from '../../constants/colors'
import { EmptyState } from '../EmptyState/EmptyState'
import { FALLBACK_COLOR, TP, axisStroke, tickStyle, legendStyle } from './chartConstants'
import { useScopedFeedbacks, useHubFromScopes, useContainerClass, EMPTY_SCOPES } from './chartHooks'
import { ChartContainer, DonutWithLabels } from './ChartContainer'
import type { ChartRendererProps } from './ChartRenderer'

// ---- Feedback by type (1st property) ----

export function FeedbackByTypeChart({ config, pages, hubProperties, feedbacks, containerClass }: ChartRendererProps) {
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

export function FeedbackByDimensionChart({ config, pages, hubProperties, feedbacks, containerClass }: ChartRendererProps) {
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

export function FeedbackOverTimeChart({ config, monthCount = 12, pages, hubProperties, feedbacks, containerClass, palette }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedFeedbacks = useScopedFeedbacks(feedbacks, pages, scopes)
  const hub = useHubFromScopes(pages, scopes)
  const typeProp = hubProperties.find((p) => p.hubId === hub?.id && p.scope === 'feedback')
  const cls = useContainerClass(config, containerClass)

  const { data, keys, colorMap } = useMemo(() => {
    if (!typeProp) return { data: [], keys: [] as string[], colorMap: new Map<string, string>() }

    const now = new Date()
    let count: number = monthCount
    if (count === 0) {
      if (scopedFeedbacks.length > 0) {
        const earliest = scopedFeedbacks.reduce((min, f) => {
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
    const monthToIdx = new Map(months.map((m, i) => [m, i]))

    const data = months.map((m) => {
      const row: Record<string, string | number> = { month: `${m.slice(2, 4)}${m.slice(5)}` }
      for (const k of keys) row[k] = 0
      return row
    })

    for (const f of scopedFeedbacks) {
      const d = new Date(f.createdAt)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const idx = monthToIdx.get(m)
      if (idx === undefined) continue
      const label = valueToLabel.get(f.type)
      if (label) data[idx][label] = (Number(data[idx][label]) || 0) + 1
    }

    return { data, keys, colorMap }
  }, [scopedFeedbacks, typeProp, monthCount, palette])

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

export function FeedbackPerPageChart({ config, pages, hubProperties, feedbacks, containerClass, palette }: ChartRendererProps) {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedFeedbacks = useScopedFeedbacks(feedbacks, pages, scopes)
  const hub = useHubFromScopes(pages, scopes)
  const typeProp = hubProperties.find((p) => p.hubId === hub?.id && p.scope === 'feedback')
  const cls = useContainerClass(config, containerClass)

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


