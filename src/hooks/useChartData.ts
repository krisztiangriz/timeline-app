import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { TimelineEntry, Page, ChartScope, ChartConfig, RegexPattern } from '../types'
import { stripHtml } from '../utils/stripHtml'
import { filterHtmlToMentionLines } from '../utils/mentionParser'

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

export function getCutoff(monthCount: number): Date {
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

// ---- Regex helpers ----

function countRegexMatches(text: string, regex: RegExp): number {
  const plain = stripHtml(text)
  const matches = plain.match(regex)
  return matches ? matches.length : 0
}

function countRegexMentionMatches(html: string, pageId: number, regex: RegExp): number {
  const mentionLines = filterHtmlToMentionLines(html, pageId)
  let count = 0
  for (const line of mentionLines) {
    const plain = stripHtml(line)
    const matches = plain.match(regex)
    if (matches) count += matches.length
  }
  return count
}

// ---- Line-counting helpers ----

function splitIntoLines(html: string): string[] {
  return html.split(/<br\s*\/?>|<\/div>|<\/p>|\n/i)
}

function countNonEmptyLines(html: string): number {
  let count = 0
  for (const segment of splitIntoLines(html)) {
    if (stripHtml(segment).trim()) count++
  }
  return count
}

function countLinesWithMatch(html: string, regex: RegExp): number {
  let count = 0
  for (const segment of splitIntoLines(html)) {
    const plain = stripHtml(segment).trim()
    if (plain && plain.match(regex)) count++
  }
  return count
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

// ---- Aggregation: regex by month ----

interface PatternInfo { id: number; name: string; pattern: string }

function aggregateRegexByMonth(
  entries: TimelineEntry[], pages: Page[], scopes: ChartScope[],
  patterns: PatternInfo[], monthCount: number, aggregateByHub?: boolean, countMode?: 'date' | 'line',
): UnifiedChartData {
  if (patterns.length === 0) return { data: [], keys: [], xKey: 'month' }

  const months = buildMonthKeys(monthCount, entries)
  const hubIds = getHubIds(scopes, pages)

  // Multi-pattern
  if (patterns.length > 1) {
    const regexes: { name: string; pattern: string }[] = []
    for (const p of patterns) {
      try { new RegExp(p.pattern, 'g'); regexes.push({ name: p.name, pattern: p.pattern }) } catch { /* skip invalid */ }
    }
    if (regexes.length === 0) return { data: [], keys: [], xKey: 'month' }

    // Hub scope: series = child pages, count = sum across all patterns
    if (hubIds.length > 0) {
      const hubIdSet = new Set(hubIds)
      const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
      const childIdSet = new Set(children.map((p) => p.id!))
      const childToName = new Map(children.map((c) => [c.id!, c.name]))
      const monthToIdx = new Map(months.map((m, i) => [m, i]))

      const bucketKeys = children.map((c) => c.name)
      const data = months.map((m) => {
        const row: Record<string, string | number> = { month: formatMonthLabel(m) }
        for (const k of bucketKeys) row[k] = 0
        return row
      })
      const summaryTotals = new Map<string, number>(bucketKeys.map((k) => [k, 0]))

      for (const e of entries) {
        if (e.isPending) continue
        const m = formatMonthKey(new Date(e.date))
        const idx = monthToIdx.get(m)
        if (idx === undefined) continue
        if (childIdSet.has(e.pageId)) {
          const bucket = childToName.get(e.pageId)
          if (bucket) {
            let count = 0
            if (countMode === 'line') {
              for (const { pattern } of regexes) count += countLinesWithMatch(e.text, new RegExp(pattern, 'g'))
            } else {
              for (const { pattern } of regexes) count += countRegexMatches(e.text, new RegExp(pattern, 'g'))
            }
            data[idx][bucket] = (Number(data[idx][bucket]) || 0) + count
            summaryTotals.set(bucket, (summaryTotals.get(bucket) ?? 0) + count)
          }
        } else if (e.tagRefs) {
          for (const ref of e.tagRefs) {
            const refId = Number(ref)
            if (childIdSet.has(refId)) {
              const bucket = childToName.get(refId)
              if (bucket) {
                const c = countMode === 'line' ? countNonEmptyLines(e.text) : 1
                data[idx][bucket] = (Number(data[idx][bucket]) || 0) + c
                summaryTotals.set(bucket, (summaryTotals.get(bucket) ?? 0) + c)
              }
            }
          }
        }
      }

      const keys = bucketKeys.filter((k) => data.some((d) => Number(d[k]) > 0))
      const summary = bucketKeys.map((k) => ({ name: k, value: summaryTotals.get(k) ?? 0 })).filter((s) => s.value > 0)
      return { data, keys, xKey: 'month', summary }
    }

    // No hub scope: each pattern is a series
    const monthToIdx = new Map(months.map((m, i) => [m, i]))
    const keys = regexes.map((r) => r.name)
    const data = months.map((m) => {
      const row: Record<string, string | number> = { month: formatMonthLabel(m) }
      for (const k of keys) row[k] = 0
      return row
    })
    const totals = new Map<string, number>(keys.map((k) => [k, 0]))

    for (const e of entries) {
      if (e.isPending) continue
      const m = formatMonthKey(new Date(e.date))
      const idx = monthToIdx.get(m)
      if (idx === undefined) continue
      for (const { name, pattern } of regexes) {
        const count = countMode === 'line'
          ? countLinesWithMatch(e.text, new RegExp(pattern, 'g'))
          : countRegexMatches(e.text, new RegExp(pattern, 'g'))
        data[idx][name] = (Number(data[idx][name]) || 0) + count
        totals.set(name, (totals.get(name) ?? 0) + count)
      }
    }

    const activeKeys = keys.filter((k) => data.some((d) => Number(d[k]) > 0))
    const summary = keys.map((k) => ({ name: k, value: totals.get(k) ?? 0 })).filter((s) => s.value > 0)
    return { data, keys: activeKeys, xKey: 'month', summary }
  }

  // Single pattern
  const pat = patterns[0]
  let regex: RegExp
  try { regex = new RegExp(pat.pattern, 'g') } catch { return { data: [], keys: [], xKey: 'month' } }

  if (hubIds.length > 0) {
    const hubIdSet = new Set(hubIds)
    const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
    const childIdSet = new Set(children.map((p) => p.id!))
    const childById = new Map(children.map((c) => [c.id!, c]))
    const monthToIdx = new Map(months.map((m, i) => [m, i]))
    const hubById = new Map(hubIds.map((id) => [id, pages.find((p) => p.id === id)!]))

    const bucketKeys = aggregateByHub
      ? hubIds.map((id) => hubById.get(id)!.name)
      : children.map((c) => c.name)

    const data = months.map((m) => {
      const row: Record<string, string | number> = { month: formatMonthLabel(m) }
      for (const k of bucketKeys) row[k] = 0
      return row
    })

    const summaryTotals = new Map<string, number>(bucketKeys.map((k) => [k, 0]))

    function getBucket(childId: number): string | undefined {
      const child = childById.get(childId)
      if (!child) return undefined
      if (aggregateByHub) {
        const hub = hubById.get(child.parentId!)
        return hub?.name
      }
      return child.name
    }

    for (const e of entries) {
      if (e.isPending) continue
      const m = formatMonthKey(new Date(e.date))
      const idx = monthToIdx.get(m)
      if (idx === undefined) continue
      regex.lastIndex = 0
      if (childIdSet.has(e.pageId)) {
        const bucket = getBucket(e.pageId)
        if (bucket) {
          const count = countMode === 'line'
            ? countLinesWithMatch(e.text, new RegExp(pat.pattern, 'g'))
            : countRegexMatches(e.text, new RegExp(pat.pattern, 'g'))
          data[idx][bucket] = (Number(data[idx][bucket]) || 0) + count
          summaryTotals.set(bucket, (summaryTotals.get(bucket) ?? 0) + count)
        }
      } else if (e.tagRefs) {
        for (const ref of e.tagRefs) {
          const refId = Number(ref)
          if (childIdSet.has(refId)) {
            const bucket = getBucket(refId)
            if (bucket) {
              const c = countMode === 'line' ? countNonEmptyLines(e.text) : 1
              data[idx][bucket] = (Number(data[idx][bucket]) || 0) + c
              summaryTotals.set(bucket, (summaryTotals.get(bucket) ?? 0) + c)
            }
          }
        }
      }
    }

    const keys = bucketKeys.filter((k) => data.some((d) => Number(d[k]) > 0))
    const summary = bucketKeys
      .map((k) => ({ name: k, value: summaryTotals.get(k) ?? 0 }))
      .filter((s) => s.value > 0)

    return { data, keys, xKey: 'month', summary }
  }

  // No hub scopes: single series
  const scopePageId = scopes.length === 1 && scopes[0].type === 'page' ? scopes[0].pageId : undefined
  const data = months.map((m) => ({ month: formatMonthLabel(m), Matches: 0 } as Record<string, string | number>))
  const monthToIdx2 = new Map(months.map((m, i) => [m, i]))
  let total = 0

  for (const e of entries) {
    if (e.isPending) continue
    const m = formatMonthKey(new Date(e.date))
    const idx = monthToIdx2.get(m)
    if (idx === undefined) continue
    let count: number
    if (countMode === 'line') {
      count = scopePageId && e.pageId !== scopePageId
        ? countLinesWithMatch(e.text, new RegExp(pat.pattern, 'g'))
        : countLinesWithMatch(e.text, new RegExp(pat.pattern, 'g'))
    } else {
      count = scopePageId && e.pageId !== scopePageId
        ? countRegexMentionMatches(e.text, scopePageId, new RegExp(pat.pattern, 'g'))
        : countRegexMatches(e.text, new RegExp(pat.pattern, 'g'))
    }
    data[idx].Matches = (Number(data[idx].Matches) || 0) + count
    total += count
  }

  const summary = total > 0 ? [{ name: 'Matches', value: total }] : []
  return { data, keys: ['Matches'], xKey: 'month', summary }
}

// ---- Aggregation: regex by weekday (NEW) ----

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function aggregateRegexByWeekday(
  entries: TimelineEntry[], pages: Page[], scopes: ChartScope[],
  patterns: PatternInfo[], monthCount: number, countMode?: 'date' | 'line',
): UnifiedChartData {
  if (patterns.length === 0) return { data: [], keys: [], xKey: 'name' }

  const cutoff = getCutoff(monthCount)
  const hubIds = getHubIds(scopes, pages)

  // Multi-pattern
  if (patterns.length > 1) {
    const regexes: { name: string; pattern: string }[] = []
    for (const p of patterns) {
      try { new RegExp(p.pattern, 'g'); regexes.push({ name: p.name, pattern: p.pattern }) } catch { /* skip invalid */ }
    }
    if (regexes.length === 0) return { data: [], keys: [], xKey: 'name' }

    // Hub scope: series = child pages, count = sum across all patterns
    if (hubIds.length > 0) {
      const hubIdSet = new Set(hubIds)
      const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
      const childIdSet = new Set(children.map((p) => p.id!))
      const childToName = new Map(children.map((c) => [c.id!, c.name]))

      const bucketKeys = children.map((c) => c.name)
      const data = WEEKDAY_LABELS.map((label) => {
        const row: Record<string, string | number> = { name: label }
        for (const k of bucketKeys) row[k] = 0
        return row
      })

      for (const e of entries) {
        if (e.isPending) continue
        if (new Date(e.date) < cutoff) continue
        const jsDay = new Date(e.date).getDay()
        const idx = jsDay === 0 ? 6 : jsDay - 1
        if (childIdSet.has(e.pageId)) {
          const bucket = childToName.get(e.pageId)
          if (bucket) {
            let count = 0
            if (countMode === 'line') {
              for (const { pattern } of regexes) count += countLinesWithMatch(e.text, new RegExp(pattern, 'g'))
            } else {
              for (const { pattern } of regexes) count += countRegexMatches(e.text, new RegExp(pattern, 'g'))
            }
            data[idx][bucket] = (Number(data[idx][bucket]) || 0) + count
          }
        } else if (e.tagRefs) {
          for (const ref of e.tagRefs) {
            const refId = Number(ref)
            if (childIdSet.has(refId)) {
              const bucket = childToName.get(refId)
              if (bucket) {
                const c = countMode === 'line' ? countNonEmptyLines(e.text) : 1
                data[idx][bucket] = (Number(data[idx][bucket]) || 0) + c
              }
            }
          }
        }
      }

      const keys = bucketKeys.filter((k) => data.some((d) => Number(d[k]) > 0))
      return { data, keys, xKey: 'name' }
    }

    // No hub scope: each pattern is a series
    const keys = regexes.map((r) => r.name)
    const data = WEEKDAY_LABELS.map((label) => {
      const row: Record<string, string | number> = { name: label }
      for (const k of keys) row[k] = 0
      return row
    })

    for (const e of entries) {
      if (e.isPending) continue
      if (new Date(e.date) < cutoff) continue
      const jsDay = new Date(e.date).getDay()
      const idx = jsDay === 0 ? 6 : jsDay - 1
      for (const { name, pattern } of regexes) {
        const count = countMode === 'line'
          ? countLinesWithMatch(e.text, new RegExp(pattern, 'g'))
          : countRegexMatches(e.text, new RegExp(pattern, 'g'))
        data[idx][name] = (Number(data[idx][name]) || 0) + count
      }
    }

    const activeKeys = keys.filter((k) => data.some((d) => Number(d[k]) > 0))
    return { data, keys: activeKeys, xKey: 'name' }
  }

  // Single pattern
  const pat = patterns[0]
  let regex: RegExp
  try { regex = new RegExp(pat.pattern, 'g') } catch { return { data: [], keys: [], xKey: 'name' } }
  void regex

  if (hubIds.length > 0) {
    const hubIdSet = new Set(hubIds)
    const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
    const childIdSet = new Set(children.map((p) => p.id!))
    const childToName = new Map(children.map((c) => [c.id!, c.name]))

    const bucketKeys = children.map((c) => c.name)
    const data = WEEKDAY_LABELS.map((label) => {
      const row: Record<string, string | number> = { name: label }
      for (const k of bucketKeys) row[k] = 0
      return row
    })

    for (const e of entries) {
      if (e.isPending) continue
      if (new Date(e.date) < cutoff) continue
      const jsDay = new Date(e.date).getDay()
      const idx = jsDay === 0 ? 6 : jsDay - 1
      if (childIdSet.has(e.pageId)) {
        const bucket = childToName.get(e.pageId)
        if (bucket) {
          const count = countMode === 'line'
            ? countLinesWithMatch(e.text, new RegExp(pat.pattern, 'g'))
            : countRegexMatches(e.text, new RegExp(pat.pattern, 'g'))
          data[idx][bucket] = (Number(data[idx][bucket]) || 0) + count
        }
      } else if (e.tagRefs) {
        for (const ref of e.tagRefs) {
          const refId = Number(ref)
          if (childIdSet.has(refId)) {
            const bucket = childToName.get(refId)
            if (bucket) {
              const c = countMode === 'line' ? countNonEmptyLines(e.text) : 1
              data[idx][bucket] = (Number(data[idx][bucket]) || 0) + c
            }
          }
        }
      }
    }

    const keys = bucketKeys.filter((k) => data.some((d) => Number(d[k]) > 0))
    return { data, keys, xKey: 'name' }
  }

  // Single series
  const scopePageId = scopes.length === 1 && scopes[0].type === 'page' ? scopes[0].pageId : undefined
  const data = WEEKDAY_LABELS.map((label) => ({ name: label, Matches: 0 } as Record<string, string | number>))

  for (const e of entries) {
    if (e.isPending) continue
    if (new Date(e.date) < cutoff) continue
    const jsDay = new Date(e.date).getDay()
    const idx = jsDay === 0 ? 6 : jsDay - 1
    let count: number
    if (countMode === 'line') {
      count = countLinesWithMatch(e.text, new RegExp(pat.pattern, 'g'))
    } else {
      count = scopePageId && e.pageId !== scopePageId
        ? countRegexMentionMatches(e.text, scopePageId, new RegExp(pat.pattern, 'g'))
        : countRegexMatches(e.text, new RegExp(pat.pattern, 'g'))
    }
    data[idx].Matches = (Number(data[idx].Matches) || 0) + count
  }

  return { data, keys: ['Matches'], xKey: 'name' }
}

// ---- Aggregation: entries by month (NEW) ----

function aggregateEntriesByMonth(
  entries: TimelineEntry[], pages: Page[], scopes: ChartScope[], monthCount: number, countMode?: 'date' | 'line',
): UnifiedChartData {
  const months = buildMonthKeys(monthCount, entries)
  const hubIds = getHubIds(scopes, pages)

  if (hubIds.length > 0) {
    const hubIdSet = new Set(hubIds)
    const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
    const childIdSet = new Set(children.map((p) => p.id!))
    const childToName = new Map(children.map((c) => [c.id!, c.name]))

    const monthToIdx = new Map(months.map((m, i) => [m, i]))
    const bucketKeys = children.map((c) => c.name)
    const data = months.map((m) => {
      const row: Record<string, string | number> = { month: formatMonthLabel(m) }
      for (const k of bucketKeys) row[k] = 0
      return row
    })

    for (const e of entries) {
      if (e.isPending) continue
      const m = formatMonthKey(new Date(e.date))
      const idx = monthToIdx.get(m)
      if (idx === undefined) continue
      const inc = countMode === 'line' ? countNonEmptyLines(e.text) : 1
      if (childIdSet.has(e.pageId)) {
        const bucket = childToName.get(e.pageId)
        if (bucket) data[idx][bucket] = (Number(data[idx][bucket]) || 0) + inc
      } else if (e.tagRefs) {
        for (const ref of e.tagRefs) {
          const refId = Number(ref)
          if (childIdSet.has(refId)) {
            const bucket = childToName.get(refId)
            if (bucket) data[idx][bucket] = (Number(data[idx][bucket]) || 0) + inc
          }
        }
      }
    }

    const keys = bucketKeys.filter((k) => data.some((d) => Number(d[k]) > 0))
    return { data, keys, xKey: 'month' }
  }

  const scopePageId = scopes.length === 1 && scopes[0].type === 'page' ? scopes[0].pageId : undefined
  const monthToIdx = new Map(months.map((m, i) => [m, i]))
  const data = months.map((m) => ({ month: formatMonthLabel(m), Entries: 0 } as Record<string, string | number>))

  for (const e of entries) {
    if (e.isPending) continue
    const m = formatMonthKey(new Date(e.date))
    const idx = monthToIdx.get(m)
    if (idx === undefined) continue
    let inc: number
    if (countMode === 'line') {
      inc = scopePageId && e.pageId !== scopePageId
        ? filterHtmlToMentionLines(e.text, scopePageId).length
        : countNonEmptyLines(e.text)
    } else {
      inc = 1
    }
    data[idx].Entries = (Number(data[idx].Entries) || 0) + inc
  }

  return { data, keys: ['Entries'], xKey: 'month' }
}

// ---- Aggregation: entries by weekday ----

function aggregateEntriesByWeekday(
  entries: TimelineEntry[], pages: Page[], scopes: ChartScope[], monthCount: number, countMode?: 'date' | 'line',
): UnifiedChartData {
  const cutoff = getCutoff(monthCount)
  const hubIds = getHubIds(scopes, pages)

  if (hubIds.length > 0) {
    const hubIdSet = new Set(hubIds)
    const children = pages.filter((p) => p.parentId && hubIdSet.has(p.parentId))
    const childIdSet = new Set(children.map((p) => p.id!))
    const childToName = new Map(children.map((c) => [c.id!, c.name]))

    const bucketKeys = children.map((c) => c.name)
    const data = WEEKDAY_LABELS.map((label) => {
      const row: Record<string, string | number> = { name: label }
      for (const k of bucketKeys) row[k] = 0
      return row
    })

    for (const e of entries) {
      if (e.isPending) continue
      if (new Date(e.date) < cutoff) continue
      const jsDay = new Date(e.date).getDay()
      const idx = jsDay === 0 ? 6 : jsDay - 1
      const inc = countMode === 'line' ? countNonEmptyLines(e.text) : 1
      if (childIdSet.has(e.pageId)) {
        const bucket = childToName.get(e.pageId)
        if (bucket) data[idx][bucket] = (Number(data[idx][bucket]) || 0) + inc
      } else if (e.tagRefs) {
        for (const ref of e.tagRefs) {
          const refId = Number(ref)
          if (childIdSet.has(refId)) {
            const bucket = childToName.get(refId)
            if (bucket) data[idx][bucket] = (Number(data[idx][bucket]) || 0) + inc
          }
        }
      }
    }

    const keys = bucketKeys.filter((k) => data.some((d) => Number(d[k]) > 0))
    return { data, keys, xKey: 'name' }
  }

  const scopePageId = scopes.length === 1 && scopes[0].type === 'page' ? scopes[0].pageId : undefined
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const e of entries) {
    if (e.isPending) continue
    if (new Date(e.date) < cutoff) continue
    const jsDay = new Date(e.date).getDay()
    const idx = jsDay === 0 ? 6 : jsDay - 1
    let inc: number
    if (countMode === 'line') {
      inc = scopePageId && e.pageId !== scopePageId
        ? filterHtmlToMentionLines(e.text, scopePageId).length
        : countNonEmptyLines(e.text)
    } else {
      inc = 1
    }
    counts[idx] += inc
  }

  const data = WEEKDAY_LABELS.map((label, i) => ({ name: label, Entries: counts[i] } as Record<string, string | number>))
  return { data, keys: ['Entries'], xKey: 'name' }
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

export function useUnifiedChartData(
  config: ChartConfig,
  entries: TimelineEntry[],
  pages: Page[],
  regexPatterns: RegexPattern[],
  monthCount: number,
): UnifiedChartData {
  const scopes = config.scopes ?? []
  const scopedEntries = useMemo(
    () => filterEntriesByScopes(entries, scopes, pages),
    [entries, scopes, pages],
  )

  const patterns: PatternInfo[] = useMemo(() => {
    if (config.source !== 'regex' || !config.regexPatternIds) return []
    return config.regexPatternIds
      .map((id) => regexPatterns.find((p) => p.id === id))
      .filter((p): p is RegexPattern => !!p)
      .map((p) => ({ id: p.id!, name: p.name, pattern: p.pattern }))
  }, [config.source, config.regexPatternIds, regexPatterns])

  return useMemo(() => {
    const { source, grouping, countMode } = config

    if (source === 'regex' && grouping === 'month') {
      return aggregateRegexByMonth(scopedEntries, pages, scopes, patterns, monthCount, config.aggregateByHub, countMode)
    }
    if (source === 'regex' && grouping === 'weekday') {
      return aggregateRegexByWeekday(scopedEntries, pages, scopes, patterns, monthCount, countMode)
    }
    if (source === 'entries' && grouping === 'month') {
      return aggregateEntriesByMonth(scopedEntries, pages, scopes, monthCount, countMode)
    }
    if (source === 'entries' && grouping === 'weekday') {
      return aggregateEntriesByWeekday(scopedEntries, pages, scopes, monthCount, countMode)
    }
    if (source === 'pages' && grouping === 'month') {
      return aggregatePagesByMonth(pages, scopes, monthCount)
    }

    return { data: [], keys: [], xKey: 'month' }
  }, [config, scopedEntries, pages, scopes, patterns, monthCount])
}
