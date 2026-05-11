import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { TimelineEntry, Page, ChartScope, HubProperty, PagePropertyValue } from '../types'
import { countHtmlBlocks, countMentionBlocks } from '../utils/countHtmlBlocks'

// Native date helpers
function formatMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function formatMonthLabel(key: string): string {
  const d = new Date(key + '-01')
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthKeys(monthCount: number, entries?: { date: Date | string }[]): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // monthCount === 0 means "all time" — derive range from data or default to 24 months
  let count = monthCount
  if (count === 0) {
    if (entries && entries.length > 0) {
      const earliest = entries.reduce((min, e) => {
        const d = new Date(e.date)
        return d < min ? d : min
      }, now)
      const diffMonths = (year - earliest.getFullYear()) * 12 + (month - earliest.getMonth()) + 1
      count = Math.max(diffMonths, 1)
    } else {
      count = 24
    }
  }

  const months: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    months.push(formatMonthKey(d))
  }
  return months
}

function getCutoff(monthCount: number): Date {
  if (monthCount === 0) return new Date(0) // no cutoff — include everything
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1)
}

// Re-export from constants for backward compatibility
export { CHART_COLORS, getColor } from '../constants/colors'
import { CHART_COLORS } from '../constants/colors'

// ---- Scope filtering ----

function filterEntriesByScope(entries: TimelineEntry[], scope: ChartScope, allPages: Page[]): TimelineEntry[] {
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

// ---- All entries ----

export function useAllEntries() {
  return useLiveQuery(() => db.timelineEntries.toArray()) ?? []
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
    const months = buildMonthKeys(monthCount, entries)
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
      const childById = new Map(children.map((c) => [c.id!, c]))
      const monthToIdx = new Map(months.map((m, i) => [m, i]))

      const data = months.map((m) => {
        const row: Record<string, string | number> = { month: formatMonthLabel(m) }
        for (const c of children) row[c.name] = 0
        return row
      })

      for (const e of entries) {
        if (e.isPending) continue
        const m = formatMonthKey(new Date(e.date))
        const idx = monthToIdx.get(m)
        if (idx === undefined) continue
        const counted = new Set<number>()
        if (childIdSet.has(e.pageId)) {
          const child = childById.get(e.pageId)
          if (child) { data[idx][child.name] = (Number(data[idx][child.name]) || 0) + countHtmlBlocks(e.text); counted.add(child.id!) }
        }
        if (e.tagRefs) {
          for (const ref of e.tagRefs) {
            const refId = Number(ref)
            if (counted.has(refId)) continue
            if (childIdSet.has(refId)) {
              const child = childById.get(refId)
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

    const monthToIdx2 = new Map(months.map((m, i) => [m, i]))

    for (const e of entries) {
      if (e.isPending) continue
      const m = formatMonthKey(new Date(e.date))
      const idx = monthToIdx2.get(m)
      if (idx === undefined) continue
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

// ---- Aggregation: pages by hub property ----

export function usePagesByProperty(
  pages: Page[],
  property: HubProperty | undefined,
  propertyValues: PagePropertyValue[],
) {
  return useMemo(() => {
    if (!property) return []

    // Count pages per option value
    const counts = new Map<string, number>()
    const childPages = pages.filter((p) => p.parentId === property.hubId)
    const valuesByPage = new Map<number, string>()
    for (const pv of propertyValues) {
      if (pv.propertyId === property.id) {
        valuesByPage.set(pv.pageId, pv.value)
      }
    }

    for (const page of childPages) {
      const val = valuesByPage.get(page.id!) ?? property.options[0]?.value
      if (val) counts.set(val, (counts.get(val) || 0) + 1)
    }

    return property.options
      .map((opt, i) => ({
        name: opt.label,
        value: counts.get(opt.value) || 0,
        color: opt.color ?? CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((s) => s.value > 0)
  }, [pages, property, propertyValues])
}

// ---- Page count (child page creation over time) ----

export function usePageCount(
  pages: Page[],
  scopes: ChartScope[],
  monthCount = 12,
) {
  return useMemo(() => {
    const months = buildMonthKeys(monthCount, pages.map((p) => ({ date: p.createdAt })))
    const cutoff = getCutoff(monthCount)

    // Determine which child pages to count
    let scopedPages: Page[]
    if (scopes.length > 0) {
      const hubIds = new Set<number>()
      const pageIds = new Set<number>()
      for (const s of scopes) {
        if (s.type === 'hub') hubIds.add(s.hubId)
        else if (s.type === 'page') {
          const page = pages.find((p) => p.id === s.pageId)
          if (page?.type === 'hub') hubIds.add(page.id!)
          else if (page?.parentId) pageIds.add(page.id!)
        }
      }
      scopedPages = pages.filter((p) =>
        (p.parentId && hubIds.has(p.parentId)) || pageIds.has(p.id!)
      )
    } else {
      scopedPages = pages.filter((p) => p.parentId && p.type !== 'hub')
    }

    // Build month data
    const monthToIdx = new Map(months.map((m, i) => [m, i]))
    const data = months.map((m) => ({ month: formatMonthLabel(m), count: 0 }))

    for (const p of scopedPages) {
      if (!p.createdAt) continue
      const d = new Date(p.createdAt)
      if (d < cutoff) continue
      const key = formatMonthKey(d)
      const idx = monthToIdx.get(key)
      if (idx !== undefined) data[idx].count++
    }

    return { data, keys: ['count'] }
  }, [pages, scopes, monthCount])
}
