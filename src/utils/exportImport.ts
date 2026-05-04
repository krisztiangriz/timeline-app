import { db } from '../db/database'
import DOMPurify from 'dompurify'
import type { Page } from '../types'

interface ExportData {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  exportedAt: string
  tags: unknown[]
  pages: unknown[]
  layouts: unknown[]
  timelineEntries: unknown[]
  feedbacks: unknown[]
  categories: unknown[]
  shortcuts?: unknown[]
  dimensions: unknown[]
  pageSettings: unknown[]
  blocks: unknown[]
  chartConfigs: unknown[]
  abbreviationGroups?: unknown[]
}

/**
 * After importing data, ensure all structural pages have role fields.
 * Uses the same heuristics as the v6 migration.
 */
async function ensurePageRoles(): Promise<void> {
  const allPages = await db.pages.toArray()

  // Check if roles and triggers already exist
  const hasRoles = allPages.some((p) => p.role)
  const hasTriggers = allPages.some((p) => p.mentionTrigger)
  if (hasRoles && hasTriggers) return

  // Backfill triggers on existing hubs that have roles but no triggers
  if (hasRoles && !hasTriggers) {
    for (const p of allPages) {
      if (p.role === 'colleague-hub' && !p.mentionTrigger) {
        await db.pages.update(p.id!, { mentionTrigger: '@' })
      } else if (p.role === 'project-hub' && !p.mentionTrigger) {
        await db.pages.update(p.id!, { mentionTrigger: '#' })
      }
    }
    return
  }

  // Assign roles to hubs by children types
  const hubs = allPages.filter((p) => p.type === 'hub' && !p.parentId)
  let peopleHubId: number | undefined
  let projectHubId: number | undefined

  for (const hub of hubs) {
    const children = allPages.filter((p) => p.parentId === hub.id)
    const hasPeople = children.some((c) => c.type === 'colleague')
    const hasCandidates = children.some((c) => c.type === 'candidate')
    const hasProjects = children.some((c) => c.type === 'project')

    if ((hasPeople || /people|colleague/i.test(hub.name)) && !peopleHubId) {
      await db.pages.update(hub.id!, { role: 'colleague-hub', mentionTrigger: '@' })
      peopleHubId = hub.id
    } else if (hasCandidates || /candidate/i.test(hub.name)) {
      await db.pages.update(hub.id!, { role: 'candidate-hub' })
    } else if ((hasProjects || /project/i.test(hub.name)) && !projectHubId) {
      await db.pages.update(hub.id!, { role: 'project-hub', mentionTrigger: '#' })
      projectHubId = hub.id
    }
  }

  // If no candidate hub exists, create one and move candidates
  const candidateHub = await db.pages.where('role').equals('candidate-hub').first()
  if (!candidateHub) {
    const now = new Date()
    const candidateHubId = await db.pages.add({
      name: 'Candidate hub',
      type: 'hub',
      role: 'candidate-hub',
      description: '',
      createdAt: now,
      updatedAt: now,
      editCount: 0,
    } as Page)
    await db.blocks.add({ pageId: candidateHubId as number, type: 'table', order: 0 })
    await db.blocks.add({ pageId: candidateHubId as number, type: 'text', content: '', order: 1 })

    // Move orphaned candidates
    const candidates = allPages.filter((p) => p.type === 'candidate')
    for (const c of candidates) {
      await db.pages.update(c.id!, { parentId: candidateHubId as number })
    }
  }
}

/**
 * Export all data from IndexedDB as a JSON string.
 */
async function exportAllData(): Promise<string> {
  const [tags, pages, layouts, blocks, timelineEntries, feedbacks, dimensions, pageSettings, chartConfigs] =
    await Promise.all([
      db.tags.toArray(),
      db.pages.toArray(),
      db.layouts.toArray(),
      db.blocks.toArray(),
      db.timelineEntries.toArray(),
      db.feedbacks.toArray(),
      db.dimensions.toArray(),
      db.pageSettings.toArray(),
      db.chartConfigs.toArray(),
    ])

  const data: ExportData = {
    version: 10,
    exportedAt: new Date().toISOString(),
    tags,
    pages,
    layouts,
    timelineEntries,
    feedbacks,
    categories: [],
    dimensions,
    pageSettings,
    blocks,
    chartConfigs,
  }

  return JSON.stringify(data, null, 2)
}

async function downloadJson(prefix: string) {
  const json = await exportAllData()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Download the exported data as a JSON file.
 */
export async function downloadExport() {
  await downloadJson('timeline-export')
}

/**
 * Download an automatic backup as a JSON file.
 * Uses a distinct filename prefix so users can tell backups from manual exports.
 */
export async function downloadBackup() {
  await downloadJson('timeline-backup')
}

/**
 * Import data from a JSON file, replacing all existing data.
 */
async function importData(jsonString: string): Promise<void> {
  const data: ExportData = JSON.parse(jsonString)

  if (data.version < 1 || data.version > 10) {
    throw new Error(`Unsupported export version: ${data.version}`)
  }

  // Validate required arrays exist before touching the DB
  if (!Array.isArray(data.tags) || !Array.isArray(data.pages) ||
      !Array.isArray(data.layouts) || !Array.isArray(data.timelineEntries) ||
      !Array.isArray(data.feedbacks) || !Array.isArray(data.dimensions)) {
    throw new Error('Invalid export file: missing required data tables')
  }

  // Rehydrate date fields (JSON.parse returns strings, not Date objects)
  const pages = (data.pages as Record<string, unknown>[]).map((p) => ({
    ...p,
    createdAt: new Date(p.createdAt as string),
    updatedAt: new Date(p.updatedAt as string),
  }))
  const entries = (data.timelineEntries as Record<string, unknown>[]).map((e) => ({
    ...e,
    text: typeof e.text === 'string' ? DOMPurify.sanitize(e.text) : e.text,
    date: new Date(e.date as string),
    createdAt: new Date(e.createdAt as string),
    updatedAt: new Date(e.updatedAt as string),
  }))
  const feedbacks = (data.feedbacks as Record<string, unknown>[]).map((f) => ({
    ...f,
    description: typeof f.description === 'string' ? DOMPurify.sanitize(f.description) : f.description,
    createdAt: new Date(f.createdAt as string),
  }))
  // Sanitize text content in blocks
  const blocks = data.blocks?.length
    ? (data.blocks as Record<string, unknown>[]).map((b) => ({
        ...b,
        content: typeof b.content === 'string' ? DOMPurify.sanitize(b.content) : b.content,
      }))
    : undefined

  // Run everything in a transaction so failure rolls back
  await db.transaction('rw',
    [db.tags, db.pages, db.layouts, db.blocks, db.timelineEntries, db.feedbacks, db.dimensions, db.pageSettings, db.chartConfigs],
    async () => {
      await Promise.all([
        db.tags.clear(), db.pages.clear(), db.layouts.clear(), db.blocks.clear(),
        db.timelineEntries.clear(), db.feedbacks.clear(),
        db.dimensions.clear(), db.pageSettings.clear(), db.chartConfigs.clear(),
      ])
      await Promise.all([
        db.tags.bulkAdd(data.tags as never[]),
        db.pages.bulkAdd(pages as never[]),
        db.layouts.bulkAdd(data.layouts as never[]),
        blocks?.length ? db.blocks.bulkAdd(blocks as never[]) : Promise.resolve(),
        db.timelineEntries.bulkAdd(entries as never[]),
        db.feedbacks.bulkAdd(feedbacks as never[]),
        db.dimensions.bulkAdd(data.dimensions as never[]),
        data.pageSettings?.length ? db.pageSettings.bulkAdd(data.pageSettings as never[]) : Promise.resolve(),
        data.chartConfigs?.length ? db.chartConfigs.bulkAdd(data.chartConfigs as never[]) : Promise.resolve(),
      ])
    }
  )

  // Post-import: ensure role fields exist on structural pages
  await ensurePageRoles()
}

/**
 * Trigger a file picker and import from selected JSON file.
 */
export function triggerImport(): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve()
        return
      }
      try {
        const text = await file.text()
        await importData(text)
        resolve()
      } catch (err) {
        reject(err)
      }
    }
    input.click()
  })
}
