import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { EntryTag } from '../types'

export function useEntryTags(): EntryTag[] {
  return useLiveQuery(() => db.entryTags.orderBy('order').toArray(), []) ?? []
}

export async function addEntryTag(name: string, slug: string, category: string): Promise<number> {
  const all = await db.entryTags.toArray()
  const maxOrder = all.length > 0 ? Math.max(...all.map((t) => t.order)) : -1
  const id = await db.entryTags.add({ name, slug, category, order: maxOrder + 1 })
  return id as number
}

export async function updateEntryTag(id: number, updates: Partial<{ name: string; slug: string; category: string }>) {
  await db.entryTags.update(id, updates)
}

export async function deleteEntryTag(id: number) {
  await db.entryTags.delete(id)
}
