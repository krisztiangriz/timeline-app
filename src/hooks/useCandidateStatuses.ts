import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'

/**
 * Get all candidate statuses, ordered.
 */
export function useCandidateStatuses() {
  return useLiveQuery(() => db.candidateStatuses.orderBy('order').toArray()) ?? []
}

// Standalone async functions — stable references, no hook overhead

export async function addCandidateStatus(name: string): Promise<number> {
  const maxOrder = await db.candidateStatuses.orderBy('order').last()
  const value = name.toLowerCase().replace(/\s+/g, '-')
  const id = await db.candidateStatuses.add({
    name,
    value,
    order: (maxOrder?.order ?? -1) + 1,
  })
  return id as number
}

export async function deleteCandidateStatus(id: number) {
  const status = await db.candidateStatuses.get(id)
  if (!status) return
  const remaining = await db.candidateStatuses.where('id').notEqual(id).sortBy('order')
  if (remaining.length === 0) return // don't delete the last one
  const fallback = remaining[0].value
  await db.transaction('rw', [db.pages, db.candidateStatuses], async () => {
    // Reassign candidates using this status to the first remaining status
    const affected = await db.pages
      .filter((p) => p.candidateStatus === status.value)
      .toArray()
    for (const p of affected) {
      await db.pages.update(p.id!, { candidateStatus: fallback })
    }
    await db.candidateStatuses.delete(id)
  })
}

export async function renameCandidateStatus(id: number, newName: string) {
  const status = await db.candidateStatuses.get(id)
  if (!status) return
  const newValue = newName.toLowerCase().replace(/\s+/g, '-')
  const oldValue = status.value
  await db.transaction('rw', [db.pages, db.candidateStatuses], async () => {
    await db.candidateStatuses.update(id, { name: newName, value: newValue })
    if (oldValue !== newValue) {
      const affected = await db.pages
        .filter((p) => p.candidateStatus === oldValue)
        .toArray()
      for (const p of affected) {
        await db.pages.update(p.id!, { candidateStatus: newValue })
      }
    }
  })
}
