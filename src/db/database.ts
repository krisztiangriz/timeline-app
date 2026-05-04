import Dexie, { type Table } from 'dexie'
import type {
  Page,
  Tab,
  Block,
  TimelineEntry,
  Feedback,
  Dimension,
  PageSetting,
  ChartConfig,
} from '../types'

class TimelineDB extends Dexie {
  tags!: Table              // Legacy: kept for migration/import compatibility
  pages!: Table<Page>
  layouts!: Table<Tab>
  blocks!: Table<Block>
  timelineEntries!: Table<TimelineEntry>
  feedbacks!: Table<Feedback>
  dimensions!: Table<Dimension>
  pageSettings!: Table<PageSetting>
  chartConfigs!: Table<ChartConfig>

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
  }
}

export const db = new TimelineDB()
