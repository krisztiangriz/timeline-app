import { useMemo } from 'react'
import { filterEntriesByScopes } from '../../hooks/useChartData'
import type { ChartConfig, ChartScope, TimelineEntry, Page, Feedback } from '../../types'
import styles from './Charts.module.css'
import { EMPTY_SCOPES } from './chartConstants'

export function useScopedEntries(entries: TimelineEntry[], pages: Page[], scopes: ChartScope[]) {
  return useMemo(() => filterEntriesByScopes(entries, scopes, pages), [entries, scopes, pages])
}

export function useContainerClass(config: ChartConfig, containerClass?: string) {
  return containerClass ?? (config.chartType === 'pie' ? styles.chartContainerPie : styles.chartContainer)
}

export function useScopedFeedbacks(allFeedbacks: Feedback[], pages: Page[], scopes: ChartScope[]) {
  return useMemo(() => {
    if (scopes.length === 0) return allFeedbacks
    const pageIds = new Set<number>()
    for (const s of scopes) {
      if (s.type === 'page') {
        const page = pages.find((p) => p.id === s.pageId)
        if (page?.type === 'hub') {
          for (const p of pages) { if (p.parentId === s.pageId) pageIds.add(p.id!) }
        } else {
          pageIds.add(s.pageId)
        }
      }
      if (s.type === 'hub') {
        for (const p of pages) { if (p.parentId === s.hubId) pageIds.add(p.id!) }
      }
    }
    return pageIds.size > 0 ? allFeedbacks.filter((f) => pageIds.has(f.subjectId)) : allFeedbacks
  }, [allFeedbacks, pages, scopes])
}

export function useHubFromScopes(pages: Page[], scopes: ChartScope[]) {
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

export { EMPTY_SCOPES }
