import { db } from '../db/database'
import DOMPurify from 'dompurify'
import type { Page } from '../types'

// ---- Import validation helpers ----

function isValidPage(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false
  const pg = p as Record<string, unknown>
  return typeof pg.name === 'string' && typeof pg.type === 'string'
}

function isValidEntry(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const en = e as Record<string, unknown>
  return typeof en.pageId === 'number' && typeof en.text === 'string'
}

function isValidFeedback(f: unknown): boolean {
  if (!f || typeof f !== 'object') return false
  const fb = f as Record<string, unknown>
  return typeof fb.subjectId === 'number' && typeof fb.type === 'string'
}

function isValidBlock(b: unknown): boolean {
  if (!b || typeof b !== 'object') return false
  const bl = b as Record<string, unknown>
  return typeof bl.pageId === 'number' && typeof bl.type === 'string'
}

interface ExportData {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
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
  candidateStatuses?: unknown[]
  hubProperties?: unknown[]
  pagePropertyValues?: unknown[]
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
    await db.blocks.add({ pageId: candidateHubId as number, type: 'table' })
    await db.blocks.add({ pageId: candidateHubId as number, type: 'text', content: '' })

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
  const [tags, pages, layouts, blocks, timelineEntries, feedbacks, pageSettings, chartConfigs, hubProperties, pagePropertyValues] =
    await Promise.all([
      db.tags.toArray(),
      db.pages.toArray(),
      db.layouts.toArray(),
      db.blocks.toArray(),
      db.timelineEntries.toArray(),
      db.feedbacks.toArray(),
      db.pageSettings.toArray(),
      db.chartConfigs.toArray(),
      db.hubProperties.toArray(),
      db.pagePropertyValues.toArray(),
    ])

  const data: ExportData = {
    version: 12,
    exportedAt: new Date().toISOString(),
    tags,
    pages,
    layouts,
    timelineEntries,
    feedbacks,
    categories: [],
    dimensions: [],
    pageSettings,
    blocks,
    chartConfigs,
    hubProperties,
    pagePropertyValues,
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

  if (data.version < 1 || data.version > 12) {
    throw new Error(`Unsupported export version: ${data.version}`)
  }

  // Validate required arrays exist before touching the DB
  if (!Array.isArray(data.tags) || !Array.isArray(data.pages) ||
      !Array.isArray(data.layouts) || !Array.isArray(data.timelineEntries) ||
      !Array.isArray(data.feedbacks)) {
    throw new Error('Invalid export file: missing required data tables')
  }

  // Rehydrate date fields (JSON.parse returns strings, not Date objects)
  const pages = (data.pages as Record<string, unknown>[])
    .filter(isValidPage)
    .map((p) => ({
      ...p,
      createdAt: new Date(p.createdAt as string),
      updatedAt: new Date(p.updatedAt as string),
      // Validate mentionTrigger is at most 1 character
      ...(p.mentionTrigger && typeof p.mentionTrigger === 'string' && p.mentionTrigger.length > 1
        ? { mentionTrigger: p.mentionTrigger[0] }
        : {}),
    }))
  const entries = (data.timelineEntries as Record<string, unknown>[])
    .filter(isValidEntry)
    .map((e) => ({
      ...e,
      text: typeof e.text === 'string' ? DOMPurify.sanitize(e.text) : e.text,
      date: new Date(e.date as string),
      createdAt: new Date(e.createdAt as string),
      updatedAt: new Date(e.updatedAt as string),
    }))
  const feedbacks = (data.feedbacks as Record<string, unknown>[])
    .filter(isValidFeedback)
    .map((f) => ({
      ...f,
      description: typeof f.description === 'string' ? DOMPurify.sanitize(f.description) : f.description,
      createdAt: new Date(f.createdAt as string),
    }))
  // Sanitize text content in blocks
  const blocks = data.blocks?.length
    ? (data.blocks as Record<string, unknown>[])
        .filter(isValidBlock)
        .map((b) => ({
          ...b,
          content: typeof b.content === 'string' ? DOMPurify.sanitize(b.content) : b.content,
        }))
    : undefined

  // Run everything in a transaction so failure rolls back
  await db.transaction('rw',
    [db.tags, db.pages, db.layouts, db.blocks, db.timelineEntries, db.feedbacks, db.pageSettings, db.chartConfigs, db.hubProperties, db.pagePropertyValues],
    async () => {
      await Promise.all([
        db.tags.clear(), db.pages.clear(), db.layouts.clear(), db.blocks.clear(),
        db.timelineEntries.clear(), db.feedbacks.clear(),
        db.pageSettings.clear(), db.chartConfigs.clear(),
        db.hubProperties.clear(), db.pagePropertyValues.clear(),
      ])
      await Promise.all([
        db.tags.bulkAdd(data.tags as never[]),
        db.pages.bulkAdd(pages as never[]),
        db.layouts.bulkAdd(data.layouts as never[]),
        blocks?.length ? db.blocks.bulkAdd(blocks as never[]) : Promise.resolve(),
        db.timelineEntries.bulkAdd(entries as never[]),
        db.feedbacks.bulkAdd(feedbacks as never[]),
        data.pageSettings?.length ? db.pageSettings.bulkAdd(data.pageSettings as never[]) : Promise.resolve(),
        data.chartConfigs?.length ? db.chartConfigs.bulkAdd(data.chartConfigs as never[]) : Promise.resolve(),
        data.hubProperties?.length ? db.hubProperties.bulkAdd(data.hubProperties as never[]) : Promise.resolve(),
        data.pagePropertyValues?.length ? db.pagePropertyValues.bulkAdd(data.pagePropertyValues as never[]) : Promise.resolve(),
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
    // Handle cancel: resolve if the picker is dismissed without selecting a file
    input.addEventListener('cancel', () => resolve())
    input.click()
  })
}

// ---- Merge Import ----

interface MergeImportEntry {
  date: string | Date
  text: string
  tagRefs?: string[]
  isPending?: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}

interface MergeImportFeedback {
  type: string
  description: string
  dimensionId?: string
  createdAt?: string | Date
}

interface MergeImportData {
  timelineEntries?: MergeImportEntry[]
  feedbacks?: MergeImportFeedback[]
}

/**
 * Merge (append) timeline entries and feedbacks from a JSON file into the
 * existing database without removing any existing data.
 * All entries are assigned to the given targetPageId.
 *
 * Returns a summary string describing what was added.
 */
async function mergeImportData(jsonString: string, targetPageId: number): Promise<string> {
  const data: MergeImportData = JSON.parse(jsonString)

  const entries = data.timelineEntries ?? []
  const feedbacks = data.feedbacks ?? []

  if (entries.length === 0 && feedbacks.length === 0) {
    throw new Error('File contains no timeline entries or feedbacks to merge')
  }

  // Validate target page exists
  const targetPage = await db.pages.get(targetPageId)
  if (!targetPage) {
    throw new Error(`Target page with id ${targetPageId} does not exist`)
  }

  const now = new Date()

  // Prepare timeline entries — all assigned to targetPageId
  const preparedEntries = entries.map((e) => ({
    pageId: targetPageId,
    date: new Date(e.date),
    text: DOMPurify.sanitize(e.text),
    tagRefs: e.tagRefs ?? [],
    isPending: e.isPending ?? false,
    createdAt: e.createdAt ? new Date(e.createdAt) : now,
    updatedAt: e.updatedAt ? new Date(e.updatedAt) : now,
  }))

  // Prepare feedbacks — all assigned to targetPageId as subjectId
  const preparedFeedbacks = feedbacks.map((f) => ({
    subjectId: targetPageId,
    type: f.type,
    description: DOMPurify.sanitize(f.description),
    dimensionId: f.dimensionId,
    createdAt: f.createdAt ? new Date(f.createdAt) : now,
  }))

  // Insert in a transaction (all-or-nothing)
  await db.transaction('rw', [db.timelineEntries, db.feedbacks], async () => {
    if (preparedEntries.length > 0) {
      await db.timelineEntries.bulkAdd(preparedEntries as never[])
    }
    if (preparedFeedbacks.length > 0) {
      await db.feedbacks.bulkAdd(preparedFeedbacks as never[])
    }
  })

  const parts: string[] = []
  if (preparedEntries.length > 0) {
    parts.push(`${preparedEntries.length} timeline ${preparedEntries.length === 1 ? 'entry' : 'entries'}`)
  }
  if (preparedFeedbacks.length > 0) {
    parts.push(`${preparedFeedbacks.length} ${preparedFeedbacks.length === 1 ? 'feedback' : 'feedbacks'}`)
  }
  return `Merged ${parts.join(' and ')}`
}

/**
 * Trigger a file picker and merge data from selected JSON file into existing data.
 * All entries/feedbacks in the file are assigned to the given targetPageId.
 * Returns a summary string on success.
 */
export function triggerMergeImport(targetPageId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve('')
        return
      }
      try {
        const text = await file.text()
        const summary = await mergeImportData(text, targetPageId)
        resolve(summary)
      } catch (err) {
        reject(err)
      }
    }
    // Handle cancel: resolve if the picker is dismissed without selecting a file
    input.addEventListener('cancel', () => resolve(''))
    input.click()
  })
}
