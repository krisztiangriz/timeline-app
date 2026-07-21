import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { RegexPattern } from '../types'

export function useRegexPatterns(): RegexPattern[] {
  return useLiveQuery(() => db.regexPatterns.orderBy('order').toArray(), []) ?? []
}

export function useHubAssignedPatterns(hubId?: number): RegexPattern[] {
  return useLiveQuery(async () => {
    if (!hubId) return []
    const assignments = await db.hubRegexAssignments.where('hubId').equals(hubId).toArray()
    const patternIds = assignments.map((a) => a.regexPatternId)
    if (patternIds.length === 0) return []
    return db.regexPatterns.where('id').anyOf(patternIds).toArray()
  }, [hubId]) ?? []
}

export function useHubAssignedPatternIds(hubId?: number): Set<number> {
  const ids = useLiveQuery(async () => {
    if (!hubId) return []
    const assignments = await db.hubRegexAssignments.where('hubId').equals(hubId).toArray()
    return assignments.map((a) => a.regexPatternId)
  }, [hubId]) ?? []
  return new Set(ids)
}

export async function addRegexPattern(name: string, pattern: string): Promise<number> {
  const all = await db.regexPatterns.toArray()
  const maxOrder = all.length > 0 ? Math.max(...all.map((p) => p.order)) : -1
  const id = await db.regexPatterns.add({ name, pattern, order: maxOrder + 1 })
  return id as number
}

export async function updateRegexPattern(id: number, updates: Partial<{ name: string; pattern: string }>) {
  await db.regexPatterns.update(id, updates)
}

export async function deleteRegexPattern(id: number) {
  await db.transaction('rw', [db.regexPatterns, db.hubRegexAssignments, db.chartConfigs], async () => {
    await db.hubRegexAssignments.where('regexPatternId').equals(id).delete()
    const affectedConfigs = await db.chartConfigs.filter((c) => c.regexPatternIds?.includes(id) ?? false).toArray()
    for (const config of affectedConfigs) {
      const remaining = config.regexPatternIds!.filter((pid) => pid !== id)
      if (remaining.length === 0) {
        await db.chartConfigs.delete(config.id!)
      } else {
        await db.chartConfigs.update(config.id!, { regexPatternIds: remaining })
      }
    }
    await db.regexPatterns.delete(id)
  })
}

export async function assignPatternToHub(hubId: number, regexPatternId: number) {
  const existing = await db.hubRegexAssignments.where('[hubId+regexPatternId]').equals([hubId, regexPatternId]).first()
  if (!existing) {
    await db.hubRegexAssignments.add({ hubId, regexPatternId })
  }
}

export async function unassignPatternFromHub(hubId: number, regexPatternId: number) {
  await db.hubRegexAssignments.where('[hubId+regexPatternId]').equals([hubId, regexPatternId]).delete()
}
