import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { HubProperty, PropertyOption, PagePropertyValue } from '../types'
import { CHART_COLORS } from '../constants/colors'

// ---- Queries ----

/** Get all properties defined on a hub, ordered */
export function useHubProperties(hubId?: number): HubProperty[] {
  return useLiveQuery(
    () => hubId ? db.hubProperties.where('[hubId+order]').between([hubId, -Infinity], [hubId, Infinity]).toArray() : [],
    [hubId]
  ) ?? []
}

/** Get only page-scoped properties for a hub */
export function useHubPageProperties(hubId?: number): HubProperty[] {
  return useLiveQuery(
    () => hubId
      ? db.hubProperties.where('[hubId+order]').between([hubId, -Infinity], [hubId, Infinity])
          .filter((p) => !p.scope || p.scope === 'page')
          .toArray()
      : [],
    [hubId]
  ) ?? []
}

/** Get only feedback-scoped properties for a hub */
export function useHubFeedbackProperties(hubId?: number): HubProperty[] {
  return useLiveQuery(
    () => hubId
      ? db.hubProperties.where('[hubId+order]').between([hubId, -Infinity], [hubId, Infinity])
          .filter((p) => p.scope === 'feedback')
          .toArray()
      : [],
    [hubId]
  ) ?? []
}

/** Get all property values for a page */
export function usePagePropertyValues(pageId?: number): PagePropertyValue[] {
  return useLiveQuery(
    () => pageId ? db.pagePropertyValues.where('pageId').equals(pageId).toArray() : [],
    [pageId]
  ) ?? []
}

/** Get a single property value for a page + property pair */
export function getPagePropertyValue(values: PagePropertyValue[], propertyId: number): string | undefined {
  return values.find((v) => v.propertyId === propertyId)?.value
}

// ---- Page property value actions ----

export async function setPagePropertyValue(pageId: number, propertyId: number, value: string) {
  const existing = await db.pagePropertyValues.where('[pageId+propertyId]').equals([pageId, propertyId]).first()
  if (existing) {
    await db.pagePropertyValues.update(existing.id!, { value })
  } else {
    await db.pagePropertyValues.add({ pageId, propertyId, value })
  }
}

/** Seed default property values for a new page (first option for each page-scoped property) */
export async function seedDefaultPropertyValues(pageId: number, hubId: number) {
  const allProperties = await db.hubProperties.where('[hubId+order]').between([hubId, -Infinity], [hubId, Infinity]).toArray()
  const properties = allProperties.filter((p) => !p.scope || p.scope === 'page')
  for (const prop of properties) {
    if (prop.options.length > 0) {
      await db.pagePropertyValues.add({
        pageId,
        propertyId: prop.id!,
        value: prop.options[0].value,
      })
    }
  }
}

// ---- Property CRUD (for PropertyEditor modal) ----

export async function addHubProperty(hubId: number, name: string, scope?: 'page' | 'feedback'): Promise<number> {
  const existing = await db.hubProperties.where('hubId').equals(hubId).toArray()
  const maxOrder = existing.length > 0 ? Math.max(...existing.map((p) => p.order)) : -1
  const id = await db.hubProperties.add({
    hubId,
    name,
    type: 'select',
    ...(scope ? { scope } : {}),
    options: [],
    order: maxOrder + 1,
  })
  return id as number
}

export async function deleteHubProperty(propertyId: number) {
  await db.transaction('rw', [db.hubProperties, db.pagePropertyValues], async () => {
    // Delete all stored values for this property
    await db.pagePropertyValues.where('propertyId').equals(propertyId).delete()
    await db.hubProperties.delete(propertyId)
  })
}

export async function renameHubProperty(propertyId: number, name: string) {
  await db.hubProperties.update(propertyId, { name })
}

// ---- Option CRUD ----

export async function addPropertyOption(propertyId: number, label: string) {
  const property = await db.hubProperties.get(propertyId)
  if (!property) return

  let value = label.toLowerCase().replace(/\s+/g, '-')
  // Ensure unique value within this property's options
  const existingValues = new Set(property.options.map((o) => o.value))
  let suffix = 1
  const baseValue = value
  while (existingValues.has(value)) {
    value = `${baseValue}-${suffix++}`
  }

  const usedColors = new Set(property.options.map((o) => o.color))
  const color = CHART_COLORS.find((c) => !usedColors.has(c)) ?? CHART_COLORS[property.options.length % CHART_COLORS.length]

  const options: PropertyOption[] = [...property.options, { value, label, color }]
  await db.hubProperties.update(propertyId, { options })
}

export async function deletePropertyOption(propertyId: number, optionValue: string) {
  await db.transaction('rw', [db.hubProperties, db.pagePropertyValues], async () => {
    const property = await db.hubProperties.get(propertyId)
    if (!property) return

    // Clear any page values that referenced this option
    const affected = await db.pagePropertyValues.where('propertyId').equals(propertyId).toArray()
    for (const pv of affected) {
      if (pv.value === optionValue) {
        await db.pagePropertyValues.delete(pv.id!)
      }
    }
    // Remove option from property
    const options = property.options.filter((o) => o.value !== optionValue)
    await db.hubProperties.update(propertyId, { options })
  })
}

export async function renamePropertyOption(propertyId: number, oldValue: string, newLabel: string) {
  const newValue = newLabel.toLowerCase().replace(/\s+/g, '-')

  await db.transaction('rw', [db.hubProperties, db.pagePropertyValues], async () => {
    const property = await db.hubProperties.get(propertyId)
    if (!property) return

    // Ensure unique value within this property's options (skip collision with self)
    const existingValues = new Set(property.options.filter((o) => o.value !== oldValue).map((o) => o.value))
    let finalValue = newValue
    let suffix = 1
    while (existingValues.has(finalValue)) {
      finalValue = `${newValue}-${suffix++}`
    }

    // Update the option in the property definition
    const options = property.options.map((o) =>
      o.value === oldValue ? { ...o, value: finalValue, label: newLabel } : o
    )
    await db.hubProperties.update(propertyId, { options })

    // Update any page values referencing the old value
    if (oldValue !== finalValue) {
      const affected = await db.pagePropertyValues.where('propertyId').equals(propertyId).toArray()
      for (const pv of affected) {
        if (pv.value === oldValue) {
          await db.pagePropertyValues.update(pv.id!, { value: finalValue })
        }
      }
    }
  })
}

export async function updatePropertyOptionColor(propertyId: number, optionValue: string, color: string) {
  await db.transaction('rw', db.hubProperties, async () => {
    const property = await db.hubProperties.get(propertyId)
    if (!property) return

    const options = property.options.map((o) =>
      o.value === optionValue ? { ...o, color } : o
    )
    await db.hubProperties.update(propertyId, { options })
  })
}
