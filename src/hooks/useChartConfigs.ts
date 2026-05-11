import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { ChartConfig, ChartDataSource, ChartType, ChartScope } from '../types'

export function useChartConfigs(blockId: number) {
  return useLiveQuery(
    () => db.chartConfigs.where('blockId').equals(blockId).sortBy('order'),
    [blockId],
  ) ?? []
}

export async function addChartConfig(
  blockId: number,
  name: string,
  dataSource: ChartDataSource,
  chartType: ChartType,
  scopes?: ChartScope[],
  propertyId?: number,
) {
  const existing = await db.chartConfigs.where('blockId').equals(blockId).toArray()
  const order = existing.length
  return db.chartConfigs.add({ blockId, name, dataSource, chartType, scopes, propertyId, order })
}

export async function updateChartConfig(id: number, data: Partial<ChartConfig>) {
  await db.chartConfigs.update(id, data)
}

export async function deleteChartConfig(id: number) {
  const config = await db.chartConfigs.get(id)
  if (!config) return
  await db.chartConfigs.delete(id)
  // Reorder remaining configs in one batch
  const remaining = await db.chartConfigs.where('blockId').equals(config.blockId).sortBy('order')
  if (remaining.length > 0) {
    await db.transaction('rw', db.chartConfigs, async () => {
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].order !== i) {
          await db.chartConfigs.update(remaining[i].id!, { order: i })
        }
      }
    })
  }
}
