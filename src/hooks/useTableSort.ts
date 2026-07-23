import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Page } from '../types'

type SortKey = 'name' | 'createdAt' | 'updatedAt' | 'editCount'
type SortDir = 'asc' | 'desc'

export function useTableSort(pageKey: string, defaultKey: SortKey = 'name', defaultDir: SortDir = 'asc') {
  const stored = useLiveQuery(
    () => db.pageSettings.where('pageKey').equals(pageKey).first(),
    [pageKey],
  )

  const sortKey = (stored?.sortKey as SortKey) ?? defaultKey
  const sortDir = (stored?.sortDir as SortDir) ?? defaultDir

  const toggleSort = useCallback((key: SortKey) => {
    const newDir = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
    db.pageSettings.where('pageKey').equals(pageKey).modify({ sortKey: key, sortDir: newDir }).then((updated) => {
      if (updated === 0) return db.pageSettings.add({ pageKey, sortKey: key, sortDir: newDir })
    }).catch(() => { /* storage error — non-critical */ })
  }, [pageKey, sortKey, sortDir])

  const sortPages = useCallback((pages: Page[]): Page[] => {
    return [...pages].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break
        case 'updatedAt': cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break
        case 'editCount': cmp = a.editCount - b.editCount; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [sortKey, sortDir])

  const arrow = useCallback((key: SortKey): string => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? '↑' : '↓'
  }, [sortKey, sortDir])

  return { toggleSort, sortPages, arrow }
}
