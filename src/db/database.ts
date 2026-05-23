import Dexie, { type Table } from 'dexie'
import type {
  Page,
  Tab,
  Block,
  TimelineEntry,
  Feedback,
  PageSetting,
  ChartConfig,
  HubProperty,
  PagePropertyValue,
} from '../types'

class TimelineDB extends Dexie {
  tags!: Table              // Legacy: kept for migration/import compatibility
  pages!: Table<Page>
  layouts!: Table<Tab>
  blocks!: Table<Block>
  timelineEntries!: Table<TimelineEntry>
  feedbacks!: Table<Feedback>
  pageSettings!: Table<PageSetting>
  chartConfigs!: Table<ChartConfig>
  hubProperties!: Table<HubProperty>
  pagePropertyValues!: Table<PagePropertyValue>

  constructor() {
    super('TimelineApp')
    this.version(1).stores({
      tags: '++id, name, shorthand, type, pageId',
      pages: '++id, name, type, parentId, tagId, createdAt, updatedAt',
      layouts: '++id, pageId, order',
      timelineEntries: '++id, pageId, date, category, isPending, *tagRefs',
      feedbacks: '++id, subjectId, type, dimensionId, createdAt',
      categories: '++id, name, order',
      dimensions: '++id, name, order',
    })
    this.version(2).stores({
      tags: '++id, name, shorthand, type, pageId',
      pages: '++id, name, type, parentId, tagId, createdAt, updatedAt',
      layouts: '++id, pageId, order',
      timelineEntries: '++id, pageId, date, category, isPending, *tagRefs',
      feedbacks: '++id, subjectId, type, dimensionId, createdAt',
      categories: '++id, name, order',
      shortcuts: '++id, code, order',
      dimensions: '++id, name, order',
    })
    this.version(3).stores({
      tags: '++id, name, shorthand, type, pageId',
      pages: '++id, name, type, parentId, tagId, createdAt, updatedAt',
      layouts: '++id, pageId, order',
      timelineEntries: '++id, pageId, date, category, isPending, *tagRefs',
      feedbacks: '++id, subjectId, type, dimensionId, createdAt',
      categories: '++id, name, order',
      shortcuts: '++id, code, order',
      dimensions: '++id, name, order',
      pageSettings: '++id, &pageKey',
    })
    this.version(4).stores({
      tags: '++id, shorthand',
      pages: '++id, name, parentId',
      layouts: '++id, pageId',
      timelineEntries: '++id, pageId, date, *tagRefs',
      feedbacks: '++id, subjectId, createdAt',
      categories: '++id',
      shortcuts: '++id, code, order',
      dimensions: '++id, order',
      pageSettings: '++id, &pageKey',
    })
    // v5: block-based document model
    this.version(5).stores({
      tags: '++id, shorthand',
      pages: '++id, name, parentId',
      layouts: '++id, pageId',
      blocks: '++id, pageId, tabId, order',
      timelineEntries: '++id, pageId, date, *tagRefs',
      feedbacks: '++id, subjectId, createdAt',
      categories: '++id',
      shortcuts: '++id, code, order',
      dimensions: '++id, order',
      pageSettings: '++id, &pageKey',
    })
    // v6: role-based page identification + candidate hub
    this.version(6).stores({
      tags: '++id, shorthand',
      pages: '++id, name, parentId, role',
      layouts: '++id, pageId',
      blocks: '++id, pageId, tabId, order',
      timelineEntries: '++id, pageId, date, *tagRefs',
      feedbacks: '++id, subjectId, createdAt',
      categories: '++id',
      shortcuts: '++id, code, order',
      dimensions: '++id, order',
      pageSettings: '++id, &pageKey',
    }).upgrade(async (tx) => {
      const pages = tx.table('pages')
      const blocks = tx.table('blocks')
      const allPages = await pages.toArray()

      // Assign roles to existing special pages
      for (const p of allPages) {
        if (!p.parentId && p.type === 'general' && /timeline/i.test(p.name)) {
          await pages.update(p.id, { role: 'timeline' })
        } else if (!p.parentId && p.type === 'general' && /reflection/i.test(p.name)) {
          await pages.update(p.id, { role: 'reflections' })
        }
      }

      // Identify hub pages by children types
      const hubs = allPages.filter((p: { type: string; parentId?: number }) => p.type === 'hub' && !p.parentId)
      let peopleHubId: number | undefined
      let projectHubId: number | undefined

      for (const hub of hubs) {
        const children = allPages.filter((p: { parentId?: number; type: string }) => p.parentId === hub.id)
        const hasPeople = children.some((c: { type: string }) => c.type === 'colleague' || c.type === 'candidate')
        const hasProjects = children.some((c: { type: string }) => c.type === 'project')

        if (hasPeople && !peopleHubId) {
          await pages.update(hub.id, { role: 'colleague-hub' })
          peopleHubId = hub.id
        } else if (hasProjects && !projectHubId) {
          await pages.update(hub.id, { role: 'project-hub' })
          projectHubId = hub.id
        } else if (!peopleHubId && /people|colleague/i.test(hub.name)) {
          await pages.update(hub.id, { role: 'colleague-hub' })
          peopleHubId = hub.id
        } else if (!projectHubId && /project/i.test(hub.name)) {
          await pages.update(hub.id, { role: 'project-hub' })
          projectHubId = hub.id
        }
      }

      // Fallback: assign remaining unassigned hubs by order
      for (const hub of hubs) {
        const current = await pages.get(hub.id)
        if (current && !current.role) {
          if (!peopleHubId) {
          await pages.update(hub.id, { role: 'colleague-hub' })
            peopleHubId = hub.id
          } else if (!projectHubId) {
            await pages.update(hub.id, { role: 'project-hub' })
            projectHubId = hub.id
          }
        }
      }

      // Create Candidate hub
      const now = new Date()
      const candidateHubId = await pages.add({
        name: 'Candidate hub',
        type: 'hub',
        role: 'candidate-hub',
        description: '',
        createdAt: now,
        updatedAt: now,
        editCount: 0,
      })

      // Add default blocks for candidate hub
      await blocks.add({ pageId: candidateHubId, type: 'table', order: 0 })
      await blocks.add({ pageId: candidateHubId, type: 'text', content: '', order: 1 })

      // Move existing candidate pages to the new candidate hub
      const candidates = allPages.filter((p: { type: string }) => p.type === 'candidate')
      for (const c of candidates) {
        await pages.update(c.id, { parentId: candidateHubId })
      }
    })
    // v7: mention trigger field on hubs
    this.version(7).stores({
      tags: '++id, shorthand',
      pages: '++id, name, parentId, role, mentionTrigger',
      layouts: '++id, pageId',
      blocks: '++id, pageId, tabId, order',
      timelineEntries: '++id, pageId, date, *tagRefs',
      feedbacks: '++id, subjectId, createdAt',
      categories: '++id',
      shortcuts: '++id, code, order',
      dimensions: '++id, order',
      pageSettings: '++id, &pageKey',
    })
    // v8: configurable chart configs per visualization block
    this.version(8).stores({
      tags: '++id, shorthand',
      pages: '++id, name, parentId, role, mentionTrigger',
      layouts: '++id, pageId',
      blocks: '++id, pageId, tabId, order',
      timelineEntries: '++id, pageId, date, *tagRefs',
      feedbacks: '++id, subjectId, createdAt',
      categories: '++id',
      shortcuts: '++id, code, order',
      dimensions: '++id, order',
      pageSettings: '++id, &pageKey',
      chartConfigs: '++id, blockId, order',
    })
    // v9: abbreviation groups + groupId on abbreviations
    this.version(9).stores({
      tags: '++id, shorthand',
      pages: '++id, name, parentId, role, mentionTrigger',
      layouts: '++id, pageId',
      blocks: '++id, pageId, tabId, order',
      timelineEntries: '++id, pageId, date, *tagRefs',
      feedbacks: '++id, subjectId, createdAt',
      categories: '++id',
      shortcuts: '++id, code, order, groupId',
      abbreviationGroups: '++id, order',
      dimensions: '++id, order',
      pageSettings: '++id, &pageKey',
      chartConfigs: '++id, blockId, order',
    })
    // v10: remove abbreviations + groups, add candidateStatus, hub-based charts
    this.version(10).stores({
      tags: '++id, shorthand',
      pages: '++id, name, parentId, role, mentionTrigger, candidateStatus',
      layouts: '++id, pageId',
      blocks: '++id, pageId, tabId, order',
      timelineEntries: '++id, pageId, date, *tagRefs',
      feedbacks: '++id, subjectId, createdAt',
      categories: '++id',
      shortcuts: null,
      abbreviationGroups: null,
      dimensions: '++id, order',
      pageSettings: '++id, &pageKey',
      chartConfigs: '++id, blockId, order',
    })
    // v11: optimize indexes — add compound [pageId+tabId] on blocks, remove unused indexes, drop legacy categories
    this.version(11).stores({
      tags: '++id, shorthand',
      pages: '++id, parentId, role',
      layouts: '++id, pageId',
      blocks: '++id, pageId, [pageId+tabId], order',
      timelineEntries: '++id, pageId, date, *tagRefs',
      feedbacks: '++id, subjectId, createdAt',
      categories: null,
      dimensions: '++id, order',
      pageSettings: '++id, &pageKey',
      chartConfigs: '++id, blockId, order',
    })
    // v12: migrate deprecated scope → scopes on chartConfigs
    this.version(12).stores({}).upgrade(async (tx) => {
      const configs = tx.table('chartConfigs')
      await configs.toCollection().modify((config: Record<string, unknown>) => {
        if (config.scope && !config.scopes) {
          config.scopes = [config.scope]
        }
        delete config.scope
      })
    })
    // v13: user-configurable candidate statuses
    this.version(13).stores({
      candidateStatuses: '++id, order',
    }).upgrade(async (tx) => {
      const table = tx.table('candidateStatuses')
      const defaults = [
        { name: 'Active', value: 'active', order: 0 },
        { name: 'Recommended', value: 'recommended', order: 1 },
        { name: 'Hired', value: 'hired', order: 2 },
        { name: 'Rejected', value: 'rejected', order: 3 },
        { name: 'Withdrawn', value: 'withdrawn', order: 4 },
      ]
      for (const s of defaults) await table.add(s)
    })
    // v14: backfill color on candidate statuses
    this.version(14).stores({}).upgrade(async (tx) => {
      const colors = ['#7EB3FF', '#6DD4B1', '#B497F0', '#FFB870', '#6CC7CC']
      const table = tx.table('candidateStatuses')
      const all = await table.toArray()
      for (let i = 0; i < all.length; i++) {
        const record = all[i] as { id?: number; color?: string }
        if (!record.color && record.id != null) {
          await table.update(record.id, { color: colors[i % colors.length] })
        }
      }
    })
    // v15: hub-level configurable properties (replaces candidateStatuses)
    this.version(15).stores({
      hubProperties: '++id, hubId, [hubId+order]',
      pagePropertyValues: '++id, pageId, propertyId, [pageId+propertyId]',
      candidateStatuses: null,
    }).upgrade(async (tx) => {
      const hubProps = tx.table('hubProperties')
      const propValues = tx.table('pagePropertyValues')
      const pages = tx.table('pages')
      const oldStatuses = tx.table('candidateStatuses')

      // Find candidate hub
      const allPages = await pages.toArray() as Page[]
      const candidateHub = allPages.find((p: Page) => p.role === 'candidate-hub')
      if (!candidateHub?.id) return

      // Read old statuses
      const statuses = await oldStatuses.orderBy('order').toArray() as { id?: number; name: string; value: string; color?: string; order: number }[]
      if (statuses.length === 0) return

      // Create a "Status" hub property with all old status options
      const defaultColors = ['#4A9AF5', '#3BB88E', '#9B7CE0', '#E07090', '#7B8FA6']
      const options = statuses.map((s, i) => ({
        value: s.value,
        label: s.name,
        color: s.color ?? defaultColors[i % defaultColors.length],
      }))

      const propertyId = await hubProps.add({
        hubId: candidateHub.id,
        name: 'Status',
        type: 'select',
        options,
        order: 0,
      })

      // Migrate page candidateStatus values to pagePropertyValues
      const candidates = allPages.filter((p: Page) => p.type === 'candidate')
      for (const page of candidates) {
        const statusValue = (page as unknown as { candidateStatus?: string }).candidateStatus ?? statuses[0].value
        await propValues.add({
          pageId: page.id!,
          propertyId: propertyId as number,
          value: statusValue,
        })
      }
    })
    // v16: no-op (reserved for future use)
    this.version(16).stores({})
    // v17: drop legacy dimensions table (feedback properties are now configured per-hub via PropertyEditor)
    this.version(17).stores({
      dimensions: null,
    })
    // v18: one block per tab — split multi-block tabs, clean hubs, remove order index
    this.version(18).stores({
      blocks: '++id, pageId, [pageId+tabId]',
    }).upgrade(async (tx) => {
      const pages = tx.table('pages')
      const blocks = tx.table('blocks')
      const layouts = tx.table('layouts')

      const allPages = await pages.toArray() as Page[]
      const allBlocks = await blocks.toArray() as { id?: number; pageId: number; tabId?: number; type: string; content?: string; order: number }[]
      const allTabs = await layouts.toArray() as { id?: number; pageId: number; type: string; name: string; order: number }[]

      const BLOCK_TYPE_NAMES: Record<string, string> = {
        timeline: 'Timeline',
        feedback: 'Feedback',
        visualization: 'Visualization',
        text: 'Notes',
        table: 'Table',
      }

      for (const page of allPages) {
        const isHub = page.type === 'hub'
        const isMainTimeline = page.role === 'main-timeline'

        // Hub pages: ensure exactly visualization + table at page-level, delete all tabs + extras
        if (isHub) {
          const pageBlocks = allBlocks.filter((b) => b.pageId === page.id)
          const pageTabs = allTabs.filter((t) => t.pageId === page.id)
          // Delete all tabs for hubs
          for (const tab of pageTabs) {
            if (tab.id) await layouts.delete(tab.id)
          }
          // Delete non viz/table blocks, cascade chartConfigs
          for (const b of pageBlocks) {
            if (b.type !== 'visualization' && b.type !== 'table') {
              if (b.id) await blocks.delete(b.id)
            } else {
              // Clear tabId (page-level for hubs)
              if (b.tabId && b.id) await blocks.update(b.id, { tabId: undefined })
            }
          }
          // Ensure viz + table exist
          const remaining = await blocks.where('pageId').equals(page.id!).toArray()
          const hasViz = remaining.some((b: { type: string }) => b.type === 'visualization')
          const hasTable = remaining.some((b: { type: string }) => b.type === 'table')
          if (!hasViz) await blocks.add({ pageId: page.id!, type: 'visualization' })
          if (!hasTable) await blocks.add({ pageId: page.id!, type: 'table' })
          continue
        }

        // Main timeline: leave as-is (page-level)
        if (isMainTimeline) continue

        // Regular pages: split multi-block tabs + move page-level blocks to tabs
        const pageBlocks = allBlocks.filter((b) => b.pageId === page.id)
        const pageTabs = allTabs.filter((t) => t.pageId === page.id)
        let maxTabOrder = pageTabs.reduce((max, t) => Math.max(max, t.order), -1)

        // Track used tab names for deduplication
        const usedNames = new Set(pageTabs.map((t) => t.name))

        function getUniqueName(base: string): string {
          if (!usedNames.has(base)) { usedNames.add(base); return base }
          let i = 2
          while (usedNames.has(`${base} ${i}`)) i++
          usedNames.add(`${base} ${i}`)
          return `${base} ${i}`
        }

        // Handle page-level blocks (no tabId) → create tabs for them
        const pageLevelBlocks = pageBlocks.filter((b) => !b.tabId)
        for (const b of pageLevelBlocks) {
          // Delete table blocks on non-hub pages
          if (b.type === 'table') {
            if (b.id) await blocks.delete(b.id)
            continue
          }
          maxTabOrder++
          const tabName = getUniqueName(BLOCK_TYPE_NAMES[b.type] ?? 'Notes')
          const tabId = await layouts.add({ pageId: page.id!, type: 'tab', name: tabName, order: maxTabOrder })
          if (b.id) await blocks.update(b.id, { tabId: tabId as number })
        }

        // Handle tabs with multiple blocks → keep first, split rest into new tabs
        for (const tab of pageTabs) {
          const tabBlocks = pageBlocks.filter((b) => b.tabId === tab.id).sort((a, b) => a.order - b.order)
          if (tabBlocks.length <= 1) continue

          // Keep first block in original tab
          for (let i = 1; i < tabBlocks.length; i++) {
            const b = tabBlocks[i]
            // Delete table blocks on non-hub pages
            if (b.type === 'table') {
              if (b.id) await blocks.delete(b.id)
              continue
            }
            maxTabOrder++
            const tabName = getUniqueName(BLOCK_TYPE_NAMES[b.type] ?? 'Notes')
            const newTabId = await layouts.add({ pageId: page.id!, type: 'tab', name: tabName, order: maxTabOrder })
            if (b.id) await blocks.update(b.id, { tabId: newTabId as number })
          }
        }
      }
    })
  }
}

export const db = new TimelineDB()
