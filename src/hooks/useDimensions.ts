import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'

/**
 * Get all dimensions, ordered.
 */
export function useDimensions() {
  return useLiveQuery(() => db.dimensions.orderBy('order').toArray()) ?? []
}

/**
 * CRUD operations for dimensions.
 */
export function useDimensionActions() {
  async function addDimension(name: string): Promise<number> {
    const maxOrder = await db.dimensions.orderBy('order').last()
    const id = await db.dimensions.add({
      name,
      order: (maxOrder?.order ?? -1) + 1,
    })
    return id as number
  }

  async function deleteDimension(id: number) {
    await db.dimensions.delete(id)
  }

  return { addDimension, deleteDimension }
}
