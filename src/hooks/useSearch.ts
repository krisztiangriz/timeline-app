import { useMemo } from 'react'
import { useAutocomplete } from './useAutocomplete'
import type { Page } from '../types'

export function useSearch(query: string): Page[] {
  const { allPages } = useAutocomplete()

  return useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLowerCase()
    return allPages
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        return a.name.localeCompare(b.name)
      })
  }, [query, allPages])
}
