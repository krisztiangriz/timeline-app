import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Feedback } from '../types'

export function useFeedbackForSubject(subjectId?: number) {
  return useLiveQuery(
    () => {
      if (!subjectId) return []
      return db.feedbacks
        .where('subjectId')
        .equals(subjectId)
        .sortBy('createdAt')
        .then((arr) => arr.reverse())
    },
    [subjectId]
  ) ?? []
}

// Standalone async functions — stable references, no hook overhead

export async function addFeedback(
  data: Pick<Feedback, 'subjectId' | 'type' | 'description' | 'dimensionId'>
): Promise<number> {
  const id = await db.feedbacks.add({
    ...data,
    createdAt: new Date(),
  })
  return id as number
}

export async function updateFeedback(
  id: number,
  data: Partial<Pick<Feedback, 'type' | 'description' | 'dimensionId'>>
) {
  await db.feedbacks.update(id, data)
}

export async function deleteFeedback(id: number) {
  await db.feedbacks.delete(id)
}
