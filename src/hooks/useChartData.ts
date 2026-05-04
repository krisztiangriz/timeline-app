import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { TimelineEntry, Feedback, Page, ChartScope } from '../types'
import { countHtmlBlocks, countMentionBlocks } from '../utils/countHtmlBlocks'

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

// ---- Multi-scope filtering (union + dedup) ----

export function filterEntriesByScopes(entries: TimelineEntry[], scopes: ChartScope[], allPages: Page[]): TimelineEntry[] {
  if (scopes.length === 0) return entries
  if (scopes.length === 1) return filterEntriesByScope(entries, scopes[0], allPages)
  const seen = new Set<number>()
  const result: TimelineEntry[] = []
  for (const scope of scopes) {
    for (const e of filterEntriesByScope(entries, scope, allPages)) {
      const id = e.id!
      if (!seen.has(id)) { seen.add(id); result.push(e) }
    }
  }
  return result
}

export function filterFeedbacksByScopes(feedbacks: Feedback[], scopes: ChartScope[], allPages: Page[]): Feedback[] {
  if (scopes.length === 0) return feedbacks
  if (scopes.length === 1) return filterFeedbacksByScope(feedbacks, scopes[0], allPages)
  const seen = new Set<number>()
  const result: Feedback[] = []
  for (const scope of scopes) {
    for (const f of filterFeedbacksByScope(feedbacks, scope, allPages)) {
      const id = f.id!
      if (!seen.has(id)) { seen.add(id); result.push(f) }
    }
  }
  return result
}

// ---- All entries / feedbacks ----

export function useAllEntries() {
  return useLiveQuery(() => db.timelineEntries.toArray()) ?? []
}

export function useAllFeedbacks() {
  return useLiveQuery(() => db.feedbacks.toArray()) ?? []
}

// ---- Aggregation: entry count (scope-aware) ----
// Hub scopes → break down by children of all selected hubs
// Other scopes / empty → total over time

export function useEntryCount(
  entries: TimelineEntry[],
  pages: Page[],
  scopes: ChartScope[],
  monthCount = 12,
) {
  return useMemo(() => {
    const months = buildMonthKeys(monthCount)
    const cutoff = getCutoff(monthCount)

    // Collect hub scopes — if any scope is hub-type, do per-child breakdown
    const hubIds: number[] = []
    for (const s of scopes) {
      if (s.type === 'hub') hubIds.push(s.hubId)
      else if (s.type === 'page') {
        const page = pages.find((p) => p.id === s.pageId)
        if (page?.type === 'hub') hubIds.push(page.id!)
      }
    }

    if (hubIds.length > 0) {
      const hubIdSet = new Set(hubIds)
      const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
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
          if (child) { data[idx][child.name] = (Number(data[idx][child.name]) || 0) + countHtmlBlocks(e.text); counted.add(child.id!) }
        }
        if (e.tagRefs) {
          for (const ref of e.tagRefs) {
            const refId = Number(ref)
            if (counted.has(refId)) continue
            if (childIdSet.has(refId)) {
              const child = children.find((c) => c.id === refId)
              if (child) { data[idx][child.name] = (Number(data[idx][child.name]) || 0) + countMentionBlocks(e.text, refId); counted.add(refId) }
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
            if (e.pageId === c.id) {
              total += countHtmlBlocks(e.text)
            } else if (e.tagRefs?.includes(String(c.id))) {
              total += countMentionBlocks(e.text, c.id!)
            }
          }
          return { name: c.name, value: total }
        })
        .filter((s) => s.value > 0)

      return { data, keys, summary }
    }

    // No hub scopes (or empty scopes): single series "Entries"
    // Determine single-page scope for mention-aware counting
    const scopePageId = scopes.length === 1 && scopes[0].type === 'page'
      ? scopes[0].pageId : undefined

    const data = months.map((m) => {
      const row: Record<string, string | number> = { month: formatMonthLabel(m), Entries: 0 }
      return row
    })

    for (const e of entries) {
      if (e.isPending) continue
      const m = formatMonthKey(new Date(e.date))
      const idx = months.indexOf(m)
      if (idx === -1) continue
      const blocks = scopePageId && e.pageId !== scopePageId
        ? countMentionBlocks(e.text, scopePageId)
        : countHtmlBlocks(e.text)
      data[idx].Entries = (Number(data[idx].Entries) || 0) + blocks
    }

    const keys = ['Entries']
    let total = 0
    for (const e of entries) {
      if (e.isPending) continue
      if (new Date(e.date) < cutoff) continue
      const blocks = scopePageId && e.pageId !== scopePageId
        ? countMentionBlocks(e.text, scopePageId)
        : countHtmlBlocks(e.text)
      total += blocks
    }
    const summary = total > 0 ? [{ name: 'Entries', value: total }] : []

    return { data, keys, summary }
  }, [entries, pages, scopes, monthCount])
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
// Hub scopes → per-child dimension breakdown
// Other scopes / empty → aggregate distribution

export function useDimensionDistribution(
  feedbacks: Feedback[],
  pages: Page[],
  dimensionNames: Map<number, string>,
  scopes: ChartScope[],
  monthCount = 12,
) {
  return useMemo(() => {
    const cutoff = getCutoff(monthCount)

    // Collect hub scopes — if any scope is hub-type, do per-child breakdown
    const hubIds: number[] = []
    for (const s of scopes) {
      if (s.type === 'hub') hubIds.push(s.hubId)
      else if (s.type === 'page') {
        const page = pages.find((p) => p.id === s.pageId)
        if (page?.type === 'hub') hubIds.push(page.id!)
      }
    }

    if (hubIds.length > 0) {
      const hubIdSet = new Set(hubIds)
      const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
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

    // No hub scopes: aggregate counts by dimension
    const counts = new Map<string, number>()
    for (const f of feedbacks) {
      if (!f.dimensionId) continue
      if (new Date(f.createdAt) < cutoff) continue
      const name = dimensionNames.get(f.dimensionId) ?? `Dim ${f.dimensionId}`
      counts.set(name, (counts.get(name) || 0) + 1)
    }
    const summary = [...counts.entries()].map(([name, value]) => ({ name, value }))

    return { perChild: false as const, summary }
  }, [feedbacks, pages, dimensionNames, scopes, monthCount])
}
