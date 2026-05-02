import { useState, useEffect, useCallback } from 'react'
import { db } from '../db/database'
import type { Page } from '../types'

type SortKey = 'name' | 'createdAt' | 'updatedAt' | 'editCount'
type SortDir = 'asc' | 'desc'

export function useTableSort(pageKey: string, defaultKey: SortKey = 'name', defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<SortKey>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)
  const [loaded, setLoaded] = useState(false)

  // Load saved sort from DB
  useEffect(() => {
    db.pageSettings.where('pageKey').equals(pageKey).first().then((setting) => {
      if (setting) {
        setSortKey(setting.sortKey as SortKey)
        setSortDir(setting.sortDir as SortDir)
      }
      setLoaded(true)
    })
  }, [pageKey])

  // Save to DB on change
  useEffect(() => {
    if (!loaded) return
    db.pageSettings.where('pageKey').equals(pageKey).first().then((existing) => {
      if (existing) {
        db.pageSettings.update(existing.id!, { sortKey, sortDir })
      } else {
        db.pageSettings.add({ pageKey, sortKey, sortDir })
      }
    })
  }, [pageKey, sortKey, sortDir, loaded])

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

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

  return { sortKey, sortDir, toggleSort, sortPages, arrow }
}
