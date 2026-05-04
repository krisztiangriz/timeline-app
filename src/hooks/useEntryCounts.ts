import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'

/**
 * Batch-query entry counts (timeline entries + feedbacks) for a list of page IDs.
 * Returns a reactive Map<pageId, count>.
 */
export function useEntryCounts(pageIds: number[]): Map<number, number> {
  const key = pageIds.join(',')
  return useLiveQuery(
    async () => {
      const map = new Map<number, number>()
      await Promise.all(
        pageIds.map(async (id) => {
          const [tCount, fCount] = await Promise.all([
            db.timelineEntries.where('pageId').equals(id).count(),
            db.feedbacks.where('subjectId').equals(id).count(),
          ])
          map.set(id, tCount + fCount)
        })
      )
      return map
    },
    [key]
  ) ?? new Map()
}
