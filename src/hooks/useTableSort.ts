import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '../db/database'
import type { Page } from '../types'

type SortKey = 'name' | 'createdAt' | 'updatedAt' | 'editCount'
type SortDir = 'asc' | 'desc'

export function useTableSort(pageKey: string, defaultKey: SortKey = 'name', defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<SortKey>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)
  const [loaded, setLoaded] = useState(false)
  const skipNextSave = useRef(true)

  // Load saved sort from DB
  useEffect(() => {
    let cancelled = false
    skipNextSave.current = true
    setLoaded(false)

    db.pageSettings.where('pageKey').equals(pageKey).first().then((setting) => {
      if (cancelled) return
      if (setting) {
        setSortKey(setting.sortKey as SortKey)
        setSortDir(setting.sortDir as SortDir)
      }
      setLoaded(true)
    }).catch(() => {
      if (!cancelled) setLoaded(true)
    })

    return () => { cancelled = true }
  }, [pageKey])

  // Save to DB on change (upsert via modify-or-add)
  useEffect(() => {
    if (!loaded) return
    // Skip the first save triggered by loading from DB
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    db.pageSettings.where('pageKey').equals(pageKey).modify({ sortKey, sortDir }).then((updated) => {
      if (updated === 0) return db.pageSettings.add({ pageKey, sortKey, sortDir })
    }).catch(() => { /* storage error — non-critical */ })
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
