import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { TimelineEntry, Page, ChartScope, ChartConfig, EntryTag } from '../types'
import { splitHtmlLines, extractEntryTagSlugs } from '../utils/mentionParser'

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
  if (monthCount === 0) return new Date(0)
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1)
}

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

function filterEntriesByScopes(entries: TimelineEntry[], scopes: ChartScope[], allPages: Page[]): TimelineEntry[] {
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

// ---- All entries (scoped by date range) ----

export function useAllEntries(monthCount?: number) {
  const cutoff = monthCount && monthCount > 0 ? getCutoff(monthCount) : undefined
  return useLiveQuery(() => {
    if (cutoff) {
      return db.timelineEntries.where('date').aboveOrEqual(cutoff).toArray()
    }
    return db.timelineEntries.toArray()
  }, [cutoff?.getTime()]) ?? []
}

// ---- Unified chart data interface ----

export interface UnifiedChartData {
  data: Record<string, string | number>[]
  keys: string[]
  xKey: string
  summary?: { name: string; value: number; color?: string }[]
}

// ---- Hub breakdown helpers ----

function getHubIds(scopes: ChartScope[], pages: Page[]): number[] {
  const hubIds: number[] = []
  for (const s of scopes) {
    if (s.type === 'hub') hubIds.push(s.hubId)
    else if (s.type === 'page') {
      const page = pages.find((p) => p.id === s.pageId)
      if (page?.type === 'hub') hubIds.push(page.id!)
    }
  }
  return hubIds
}

// ---- Scope resolution for line-level filtering ----

function resolveScopePageIds(scopes: ChartScope[], allPages: Page[]): Set<number> | null {
  if (scopes.length === 0) return null
  const ids = new Set<number>()
  for (const scope of scopes) {
    if (scope.type === 'global') return null
    if (scope.type === 'page') {
      const page = allPages.find((p) => p.id === scope.pageId)
      if (page?.type === 'hub') {
        ids.add(scope.pageId)
        for (const p of allPages) { if (p.parentId === scope.pageId) ids.add(p.id!) }
      } else {
        ids.add(scope.pageId)
      }
    }
    if (scope.type === 'hub') {
      for (const p of allPages) { if (p.parentId === scope.hubId) ids.add(p.id!) }
    }
  }
  return ids.size > 0 ? ids : null
}

// ---- Classification helper ----

const WORK_CATEGORY = 'Work'

function classifyEntryLines(lines: string[], entryTags: EntryTag[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (!line.includes('data-page-id=')) continue
    const slugs = extractEntryTagSlugs(line)
    let category = WORK_CATEGORY
    for (const tag of entryTags) {
      if (slugs.includes(tag.slug)) { category = tag.category; break }
    }
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return counts
}

function scopeLines(html: string, pageId: number, scopePageIds: Set<number> | null): string[] {
  const lines = splitHtmlLines(html)
  if (!scopePageIds || scopePageIds.has(pageId)) return lines
  return lines.filter((line) => {
    for (const m of line.matchAll(/data-page-id="(\d+)"/g)) {
      if (scopePageIds.has(Number(m[1]))) return true
    }
    return false
  })
}

// ---- Bucket strategy pattern ----

interface BucketStrategy {
  xKey: string
  initBuckets(entries: TimelineEntry[], monthCount: number): string[]
  bucketIndex(date: Date, bucketLookup: Map<string, number>): number | undefined
  formatLabel(key: string): string
  shouldSkip(date: Date, cutoff: Date): boolean
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const monthStrategy: BucketStrategy = {
  xKey: 'month',
  initBuckets(entries, monthCount) {
    return buildMonthKeys(monthCount, entries)
  },
  bucketIndex(date, lookup) {
    return lookup.get(formatMonthKey(date))
  },
  formatLabel(key) {
    return formatMonthLabel(key)
  },
  shouldSkip() { return false },
}

const weekdayStrategy: BucketStrategy = {
  xKey: 'name',
  initBuckets() {
    return WEEKDAY_LABELS
  },
  bucketIndex(date) {
    const jsDay = date.getDay()
    return jsDay === 0 ? 6 : jsDay - 1
  },
  formatLabel(key) {
    return key
  },
  shouldSkip(date, cutoff) { return date < cutoff },
}

// ---- Unified classify aggregation ----

function classifyByStrategy(
  entries: TimelineEntry[],
  entryTags: EntryTag[],
  monthCount: number,
  strategy: BucketStrategy,
  categories?: string[],
  scopePageIds?: Set<number> | null,
): UnifiedChartData {
  const cutoff = getCutoff(monthCount)
  const buckets = strategy.initBuckets(entries, monthCount)
  const bucketLookup = new Map(buckets.map((b, i) => [b, i]))
  const keys = [WORK_CATEGORY, ...entryTags.map((t) => t.category)]

  const data = buckets.map((b) => {
    const row: Record<string, string | number> = { [strategy.xKey]: strategy.formatLabel(b) }
    for (const k of keys) row[k] = 0
    return row
  })
  const totals = new Map<string, number>(keys.map((k) => [k, 0]))

  for (const e of entries) {
    if (e.isPending) continue
    const date = new Date(e.date)
    if (strategy.shouldSkip(date, cutoff)) continue
    const idx = strategy.bucketIndex(date, bucketLookup)
    if (idx === undefined) continue

    const lines = scopeLines(e.text, e.pageId, scopePageIds ?? null)
    const lineCounts = classifyEntryLines(lines, entryTags)
    for (const [category, count] of lineCounts) {
      data[idx][category] = (Number(data[idx][category]) || 0) + count
      totals.set(category, (totals.get(category) ?? 0) + count)
    }
  }

  const activeKeys = keys.filter((k) => (totals.get(k) ?? 0) > 0)
  const finalKeys = categories && categories.length > 0
    ? activeKeys.filter((k) => categories.includes(k))
    : activeKeys
  const summary = keys
    .map((k) => ({ name: k, value: totals.get(k) ?? 0 }))
    .filter((s) => s.value > 0 && (!categories || categories.length === 0 || categories.includes(s.name)))

  return { data, keys: finalKeys, xKey: strategy.xKey, summary }
}

// ---- Unified hub breakdown aggregation ----

function aggregateHubBreakdown(
  entries: TimelineEntry[],
  pages: Page[],
  hubIds: number[],
  strategy: BucketStrategy,
  monthCount: number,
): UnifiedChartData {
  const cutoff = getCutoff(monthCount)
  const hubIdSet = new Set(hubIds)
  const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
  const childIdSet = new Set(children.map((p) => p.id!))
  const childToName = new Map(children.map((c) => [c.id!, c.name]))

  const buckets = strategy.initBuckets(entries, monthCount)
  const bucketLookup = new Map(buckets.map((b, i) => [b, i]))
  const bucketKeys = children.map((c) => c.name)

  const data = buckets.map((b) => {
    const row: Record<string, string | number> = { [strategy.xKey]: strategy.formatLabel(b) }
    for (const k of bucketKeys) row[k] = 0
    return row
  })
  const seenDates = new Map<string, Set<string>>(bucketKeys.map((k) => [k, new Set()]))

  for (const e of entries) {
    if (e.isPending) continue
    const date = new Date(e.date)
    if (strategy.shouldSkip(date, cutoff)) continue
    const idx = strategy.bucketIndex(date, bucketLookup)
    if (idx === undefined) continue
    const dateKey = date.toISOString().slice(0, 10)

    if (childIdSet.has(e.pageId)) {
      const bucket = childToName.get(e.pageId)
      if (bucket && !seenDates.get(bucket)!.has(dateKey)) {
        seenDates.get(bucket)!.add(dateKey)
        data[idx][bucket] = (Number(data[idx][bucket]) || 0) + 1
      }
    } else if (e.tagRefs) {
      for (const ref of e.tagRefs) {
        const refId = Number(ref)
        if (childIdSet.has(refId)) {
          const bucket = childToName.get(refId)
          if (bucket && !seenDates.get(bucket)!.has(dateKey)) {
            seenDates.get(bucket)!.add(dateKey)
            data[idx][bucket] = (Number(data[idx][bucket]) || 0) + 1
          }
        }
      }
    }
  }

  const keys = bucketKeys.filter((k) => data.some((d) => Number(d[k]) > 0))
  return { data, keys, xKey: strategy.xKey }
}

// ---- Unified simple entries aggregation ----

function aggregateEntriesSimple(
  entries: TimelineEntry[],
  strategy: BucketStrategy,
  monthCount: number,
): UnifiedChartData {
  const cutoff = getCutoff(monthCount)
  const buckets = strategy.initBuckets(entries, monthCount)
  const bucketLookup = new Map(buckets.map((b, i) => [b, i]))

  const counts = new Array<number>(buckets.length).fill(0)
  const seenDates = buckets.map(() => new Set<string>())

  for (const e of entries) {
    if (e.isPending) continue
    const date = new Date(e.date)
    if (strategy.shouldSkip(date, cutoff)) continue
    const idx = strategy.bucketIndex(date, bucketLookup)
    if (idx === undefined) continue
    const dateKey = date.toISOString().slice(0, 10)
    if (!seenDates[idx].has(dateKey)) {
      seenDates[idx].add(dateKey)
      counts[idx] += 1
    }
  }

  const data = buckets.map((b, i) => ({
    [strategy.xKey]: strategy.formatLabel(b),
    Entries: counts[i],
  } as Record<string, string | number>))
  return { data, keys: ['Entries'], xKey: strategy.xKey }
}

// ---- Unified entries aggregation (hub or simple) ----

function aggregateEntriesByStrategy(
  entries: TimelineEntry[], pages: Page[], scopes: ChartScope[],
  strategy: BucketStrategy, monthCount: number,
): UnifiedChartData {
  const hubIds = getHubIds(scopes, pages)
  if (hubIds.length > 0) {
    return aggregateHubBreakdown(entries, pages, hubIds, strategy, monthCount)
  }
  return aggregateEntriesSimple(entries, strategy, monthCount)
}

// ---- Aggregation: pages by month ----

function aggregatePagesByMonth(
  pages: Page[], scopes: ChartScope[], monthCount: number,
): UnifiedChartData {
  const months = buildMonthKeys(monthCount, pages.map((p) => ({ date: p.createdAt })))
  const cutoff = getCutoff(monthCount)

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

  const monthToIdx = new Map(months.map((m, i) => [m, i]))
  const data = months.map((m) => ({ month: formatMonthLabel(m), count: 0 } as Record<string, string | number>))

  for (const p of scopedPages) {
    if (!p.createdAt) continue
    const d = new Date(p.createdAt)
    if (d < cutoff) continue
    const key = formatMonthKey(d)
    const idx = monthToIdx.get(key)
    if (idx !== undefined) data[idx].count = (Number(data[idx].count) || 0) + 1
  }

  return { data, keys: ['count'], xKey: 'month' }
}

// ---- Unified dispatcher hook ----

const EMPTY_SCOPES: ChartScope[] = []

export function useUnifiedChartData(
  config: ChartConfig,
  entries: TimelineEntry[],
  pages: Page[],
  entryTags: EntryTag[],
  monthCount: number,
): UnifiedChartData {
  const scopes = config.scopes ?? EMPTY_SCOPES
  const scopedEntries = useMemo(
    () => filterEntriesByScopes(entries, scopes, pages),
    [entries, scopes, pages],
  )

  return useMemo(() => {
    const { source, grouping } = config
    const scopePageIds = resolveScopePageIds(scopes, pages)

    if (source === 'classify' && grouping === 'month') {
      return classifyByStrategy(scopedEntries, entryTags, monthCount, monthStrategy, config.categories, scopePageIds)
    }
    if (source === 'classify' && grouping === 'weekday') {
      return classifyByStrategy(scopedEntries, entryTags, monthCount, weekdayStrategy, config.categories, scopePageIds)
    }
    if (source === 'entries' && grouping === 'month') {
      return aggregateEntriesByStrategy(scopedEntries, pages, scopes, monthStrategy, monthCount)
    }
    if (source === 'entries' && grouping === 'weekday') {
      return aggregateEntriesByStrategy(scopedEntries, pages, scopes, weekdayStrategy, monthCount)
    }
    if (source === 'pages' && grouping === 'month') {
      return aggregatePagesByMonth(pages, scopes, monthCount)
    }

    return { data: [], keys: [], xKey: 'month' }
  }, [config, scopedEntries, pages, scopes, entryTags, monthCount])
}
