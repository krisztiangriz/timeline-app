import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'

export function useSearch(query: string) {
  return useLiveQuery(
    () => {
      if (!query.trim()) return []
      const q = query.trim().toLowerCase()
      return db.pages
        .filter((p) => p.name.toLowerCase().includes(q))
        .toArray()
        .then((results) =>
          results.sort((a, b) => {
            const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
            const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
            if (aStarts !== bStarts) return aStarts - bStarts
            return a.name.localeCompare(b.name)
          })
        )
    },
    [query]
  ) ?? []
}
