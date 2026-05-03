import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { TimelineEntry, Feedback, Page, ChartScope } from '../types'

// Native date helpers
function formatMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function formatMonthLabel(key: string): string {
  const d = new Date(key + '-01')
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthKeys(monthCount: number): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const months: string[] = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    months.push(formatMonthKey(d))
  }
  return months
}

function getCutoff(monthCount: number): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1)
}

// ---- Color palette for charts ----
const CHART_COLORS = [
  '#334055', '#5E6E8C', '#485670', '#B8C5DB', '#8494B2',
  '#6E7F99', '#A0AECC', '#3D4D66', '#CDD6E4', '#7889A3',
]

export function getColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length]
}

// ---- Scope filtering ----

export function filterEntriesByScope(entries: TimelineEntry[], scope: ChartScope, allPages: Page[]): TimelineEntry[] {
  if (scope.type === 'global') return entries
  if (scope.type === 'page') {
    const page = allPages.find((p) => p.id === scope.pageId)
    if (page?.type === 'hub') {
      const childIds = new Set(allPages.filter((p) => p.parentId === scope.pageId).map((p) => p.id!))
      childIds.add(scope.pageId)
      return entries.filter((e) => childIds.has(e.pageId) || e.tagRefs?.some((r) => childIds.has(Number(r))))
    }
    const pid = String(scope.pageId)
    return entries.filter((e) => e.pageId === scope.pageId || e.tagRefs?.includes(pid))
  }
  if (scope.type === 'hub') {
    const childIds = new Set(allPages.filter((p) => p.parentId === scope.hubId).map((p) => p.id!))
    return entries.filter((e) => childIds.has(e.pageId) || e.tagRefs?.some((r) => childIds.has(Number(r))))
  }
  return entries
}

export function filterFeedbacksByScope(feedbacks: Feedback[], scope: ChartScope, allPages: Page[]): Feedback[] {
  if (scope.type === 'global') return feedbacks
  if (scope.type === 'page') {
    const page = allPages.find((p) => p.id === scope.pageId)
    if (page?.type === 'hub') {
      const childIds = new Set(allPages.filter((p) => p.parentId === scope.pageId).map((p) => p.id!))
      childIds.add(scope.pageId)
      return feedbacks.filter((f) => childIds.has(f.subjectId))
    }
    return feedbacks.filter((f) => f.subjectId === scope.pageId)
  }
  if (scope.type === 'hub') {
    const childIds = new Set(allPages.filter((p) => p.parentId === scope.hubId).map((p) => p.id!))
    return feedbacks.filter((f) => childIds.has(f.subjectId))
  }
  return feedbacks
}

// ---- All entries / feedbacks ----

export function useAllEntries() {
  return useLiveQuery(() => db.timelineEntries.toArray()) ?? []
}

export function useAllFeedbacks() {
  return useLiveQuery(() => db.feedbacks.toArray()) ?? []
}

// ---- Aggregation: entry count (scope-aware) ----
// Hub scope → break down by children
// Page scope → single page over time
// Global → total over time

export function useEntryCount(
  entries: TimelineEntry[],
  pages: Page[],
  scope: ChartScope,
  monthCount = 12,
) {
  return useMemo(() => {
    const months = buildMonthKeys(monthCount)
    const cutoff = getCutoff(monthCount)

    // Hub scope: break down by children
    if (scope.type === 'hub') {
      const children = pages.filter((p) => p.parentId === scope.hubId)
      const childIdSet = new Set(children.map((p) => p.id!))

      const data = months.map((m) => {
        const row: Record<string, string | number> = { month: formatMonthLabel(m) }
        for (const c of children) row[c.name] = 0
        return row
      })

      for (const e of entries) {
        if (e.isPending) continue
        const m = formatMonthKey(new Date(e.date))
        const idx = months.indexOf(m)
        if (idx === -1) continue
        const counted = new Set<number>()
        if (childIdSet.has(e.pageId)) {
          const child = children.find((c) => c.id === e.pageId)
          if (child) { data[idx][child.name] = (Number(data[idx][child.name]) || 0) + 1; counted.add(child.id!) }
        }
        if (e.tagRefs) {
          for (const ref of e.tagRefs) {
            const refId = Number(ref)
            if (counted.has(refId)) continue
            if (childIdSet.has(refId)) {
              const child = children.find((c) => c.id === refId)
              if (child) { data[idx][child.name] = (Number(data[idx][child.name]) || 0) + 1; counted.add(refId) }
            }
          }
        }
      }

      const keys = children.map((c) => c.name).filter((k) => data.some((d) => Number(d[k]) > 0))
      const summary = children
        .map((c) => {
          let total = 0
          for (const e of entries) {
            if (e.isPending) continue
            if (new Date(e.date) < cutoff) continue
            if (e.pageId === c.id || e.tagRefs?.includes(String(c.id))) total++
          }
          return { name: c.name, value: total }
        })
        .filter((s) => s.value > 0)

      return { data, keys, summary }
    }

    // Page or Global scope: single series "Entries"
    const data = months.map((m) => {
      const row: Record<string, string | number> = { month: formatMonthLabel(m), Entries: 0 }
      return row
    })

    for (const e of entries) {
      if (e.isPending) continue
      const m = formatMonthKey(new Date(e.date))
      const idx = months.indexOf(m)
      if (idx === -1) continue
      data[idx].Entries = (Number(data[idx].Entries) || 0) + 1
    }

    const keys = ['Entries']
    let total = 0
    for (const e of entries) {
      if (e.isPending) continue
      if (new Date(e.date) < cutoff) continue
      total++
    }
    const summary = total > 0 ? [{ name: 'Entries', value: total }] : []

    return { data, keys, summary }
  }, [entries, pages, scope, monthCount])
}

// ---- Aggregation: candidates by status ----

const STATUS_ORDER = ['active', 'recommended', 'hired', 'rejected', 'withdrawn']
const STATUS_LABELS: Record<string, string> = {
  active: 'Active', recommended: 'Recommended', hired: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn',
}

export const STATUS_COLORS: Record<string, string> = {
  Active: '#6699FF',
  Recommended: '#45C9A1',
  Hired: '#34D399',
  Rejected: '#FF6363',
  Withdrawn: '#B8C5DB',
}

export function useCandidatesByStatus(pages: Page[]) {
  return useMemo(() => {
    const candidates = pages.filter((p) => p.type === 'candidate')
    const counts = new Map<string, number>()
    for (const c of candidates) {
      const status = STATUS_LABELS[c.candidateStatus ?? 'active']
      counts.set(status, (counts.get(status) || 0) + 1)
    }
    return STATUS_ORDER
      .map((s) => ({ name: STATUS_LABELS[s], value: counts.get(STATUS_LABELS[s]) || 0 }))
      .filter((s) => s.value > 0)
  }, [pages])
}

// ---- Aggregation: feedback sentiment by month ----

export function useFeedbackByMonth(feedbacks: Feedback[], monthCount = 12) {
  return useMemo(() => {
    const months = buildMonthKeys(monthCount)

    const data = months.map((m) => ({
      month: formatMonthLabel(m),
      Positive: 0, Neutral: 0, Negative: 0,
    }))

    for (const f of feedbacks) {
      const m = formatMonthKey(new Date(f.createdAt))
      const idx = months.indexOf(m)
      if (idx === -1) continue
      if (f.type === 'positive') data[idx].Positive++
      else if (f.type === 'neutral') data[idx].Neutral++
      else data[idx].Negative++
    }

    return data
  }, [feedbacks, monthCount])
}

// ---- Aggregation: feedback summary pie ----

export function useFeedbackSummary(feedbacks: Feedback[], monthCount = 12) {
  return useMemo(() => {
    const cutoff = getCutoff(monthCount)
    const counts = { Positive: 0, Neutral: 0, Negative: 0 }
    for (const f of feedbacks) {
      if (new Date(f.createdAt) < cutoff) continue
      if (f.type === 'positive') counts.Positive++
      else if (f.type === 'neutral') counts.Neutral++
      else counts.Negative++
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value })).filter((s) => s.value > 0)
  }, [feedbacks, monthCount])
}

// ---- Aggregation: dimension distribution (scope-aware) ----
// Hub scope → per-child dimension breakdown
// Page/Global → aggregate distribution

export function useDimensionDistribution(
  feedbacks: Feedback[],
  pages: Page[],
  dimensionNames: Map<number, string>,
  scope: ChartScope,
  monthCount = 12,
) {
  return useMemo(() => {
    const cutoff = getCutoff(monthCount)

    // Hub scope: per-child dimension breakdown
    if (scope.type === 'hub') {
      const children = pages.filter((p) => p.parentId === scope.hubId)
      const dims = [...dimensionNames.values()]

      const data = children.map((c) => {
        const row: Record<string, string | number> = { name: c.name }
        for (const d of dims) row[d] = 0
        return row
      })

      for (const f of feedbacks) {
        if (!f.dimensionId) continue
        if (new Date(f.createdAt) < cutoff) continue
        const ci = children.findIndex((c) => c.id === f.subjectId)
        if (ci === -1) continue
        const dimName = dimensionNames.get(f.dimensionId)
        if (dimName) data[ci][dimName] = (Number(data[ci][dimName]) || 0) + 1
      }

      const filteredData = data.filter((d) => dims.some((dim) => Number(d[dim]) > 0))
      const keys = dims.filter((d) => filteredData.some((row) => Number(row[d]) > 0))

      return { perChild: true as const, data: filteredData, keys }
    }

    // Page or Global: aggregate counts by dimension
    const counts = new Map<string, number>()
    for (const f of feedbacks) {
      if (!f.dimensionId) continue
      if (new Date(f.createdAt) < cutoff) continue
      const name = dimensionNames.get(f.dimensionId) ?? `Dim ${f.dimensionId}`
      counts.set(name, (counts.get(name) || 0) + 1)
    }
    const summary = [...counts.entries()].map(([name, value]) => ({ name, value }))

    return { perChild: false as const, summary }
  }, [feedbacks, pages, dimensionNames, scope, monthCount])
}
