import { db } from '../db/database'
import { awaitPurify } from './domPurify'
import type {
  Page,
  Tab,
  Block,
  TimelineEntry,
  PageSetting,
  ChartConfig,
  EntryTag,
} from '../types'

// ---- Export Format ----

const CURRENT_VERSION = 18

interface ExportData {
  version: typeof CURRENT_VERSION
  exportedAt: string
  pages: Page[]
  tabs: Tab[]
  blocks: Block[]
  timelineEntries: TimelineEntry[]
  pageSettings: PageSetting[]
  chartConfigs: ChartConfig[]
  entryTags: EntryTag[]
}

// ---- Enum allowlists (runtime guards — TypeScript casts are erased at runtime) ----

const VALID_PAGE_TYPES = new Set(['general', 'candidate', 'colleague', 'project', 'hub'])
const VALID_PAGE_ROLES = new Set(['colleague-hub', 'candidate-hub', 'project-hub', 'main-timeline'])
const VALID_BLOCK_TYPES = new Set(['text', 'timeline', 'table', 'visualization'])
const VALID_CHART_SOURCES = new Set(['classify', 'entries', 'pages'])
const VALID_CHART_GROUPINGS = new Set(['month', 'weekday'])
const VALID_CHART_TYPES = new Set(['bar', 'line', 'area', 'pie'])

// ---- Validation ----

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v)
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v)
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v
  if (isString(v) || isNumber(v)) return new Date(v)
  return new Date()
}

function validatePage(raw: unknown): Page | null {
  if (!isObject(raw)) return null
  if (!isString(raw.name) || !isString(raw.type)) return null
  if (!VALID_PAGE_TYPES.has(raw.type)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    name: raw.name,
    type: raw.type as Page['type'],
    role: isString(raw.role) && VALID_PAGE_ROLES.has(raw.role) ? raw.role as Page['role'] : undefined,
    mentionTrigger: isString(raw.mentionTrigger) ? raw.mentionTrigger.slice(0, 1) : undefined,
    mentionCollapsed: raw.mentionCollapsed === true ? true : undefined,
    parentId: isNumber(raw.parentId) ? raw.parentId : undefined,
    archived: raw.archived === true ? true : undefined,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
    editCount: isNumber(raw.editCount) ? raw.editCount : 0,
  }
}

function validateTab(raw: unknown): Tab | null {
  if (!isObject(raw)) return null
  if (!isNumber(raw.pageId)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    pageId: raw.pageId,
    type: 'tab',
    name: isString(raw.name) ? raw.name : 'Untitled',
    order: isNumber(raw.order) ? raw.order : 0,
  }
}

function validateBlock(raw: unknown): Block | null {
  if (!isObject(raw)) return null
  if (!isNumber(raw.pageId) || !isString(raw.type)) return null
  if (!VALID_BLOCK_TYPES.has(raw.type)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    pageId: raw.pageId,
    tabId: isNumber(raw.tabId) ? raw.tabId : undefined,
    type: raw.type as Block['type'],
    content: isString(raw.content) ? raw.content : undefined,
  }
}

function validateTimelineEntry(raw: unknown): TimelineEntry | null {
  if (!isObject(raw)) return null
  if (!isNumber(raw.pageId) || !isString(raw.text)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    pageId: raw.pageId,
    date: toDate(raw.date),
    text: raw.text,
    tagRefs: isArray(raw.tagRefs) ? raw.tagRefs.filter(isString) : [],
    tagSlugs: isArray(raw.tagSlugs) ? raw.tagSlugs.filter(isString) : undefined,
    isPending: raw.isPending === true,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  }
}

function validatePageSetting(raw: unknown): PageSetting | null {
  if (!isObject(raw)) return null
  if (!isString(raw.pageKey) || !isString(raw.sortKey) || !isString(raw.sortDir)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    pageKey: raw.pageKey,
    sortKey: raw.sortKey,
    sortDir: raw.sortDir,
  }
}

function validateChartConfig(raw: unknown): ChartConfig | null {
  if (!isObject(raw)) return null
  if (!isNumber(raw.blockId) || !isString(raw.chartType)) return null
  if (!VALID_CHART_TYPES.has(raw.chartType)) return null

  const source = raw.source as string | undefined
  const grouping = raw.grouping as string | undefined
  if (!isString(source) || !VALID_CHART_SOURCES.has(source)) return null
  if (!isString(grouping) || !VALID_CHART_GROUPINGS.has(grouping)) return null

  let scopes: ChartConfig['scopes'] | undefined
  if (isArray(raw.scopes)) {
    const validScopes = (raw.scopes as unknown[]).filter((s) => {
      if (!isObject(s) || !isString((s as Record<string, unknown>).type)) return false
      const t = (s as Record<string, unknown>).type
      return t === 'global' || t === 'page' || t === 'hub'
    })
    scopes = validScopes.length > 0 ? validScopes as ChartConfig['scopes'] : undefined
  }

  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    blockId: raw.blockId,
    name: isString(raw.name) ? raw.name : undefined,
    source: source as ChartConfig['source'],
    grouping: grouping as ChartConfig['grouping'],
    chartType: raw.chartType as ChartConfig['chartType'],
    scopes,
    aggregateByHub: raw.aggregateByHub === true ? true : undefined,
    order: isNumber(raw.order) ? raw.order : 0,
  }
}

function validateEntryTag(raw: unknown): EntryTag | null {
  if (!isObject(raw)) return null
  if (!isString(raw.name) || !isString(raw.slug) || !isString(raw.category)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    name: raw.name,
    slug: raw.slug,
    category: raw.category,
    order: isNumber(raw.order) ? raw.order : 0,
  }
}

/** Validate and filter an array with a per-item validator */
function validateArray<T>(arr: unknown, validator: (raw: unknown) => T | null): T[] {
  if (!isArray(arr)) return []
  const results: T[] = []
  for (const item of arr) {
    const validated = validator(item)
    if (validated) results.push(validated)
  }
  return results
}

// ---- Sanitization (uses shared DOMPurify singleton) ----

function sanitizeHtml(
  records: { text?: string; content?: string }[],
  purify: { sanitize: (html: string) => string },
): void {
  for (const r of records) {
    if (typeof r.text === 'string') r.text = purify.sanitize(r.text)
    if (typeof r.content === 'string') r.content = purify.sanitize(r.content)
  }
}

// ---- Export ----

async function exportAllData(): Promise<string> {
  const [pages, tabs, blocks, timelineEntries, pageSettings, chartConfigs, entryTags] =
    await Promise.all([
      db.pages.toArray(),
      db.layouts.toArray(),
      db.blocks.toArray(),
      db.timelineEntries.toArray(),
      db.pageSettings.toArray(),
      db.chartConfigs.toArray(),
      db.entryTags.toArray(),
    ])

  const data: ExportData = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    pages,
    tabs,
    blocks,
    timelineEntries,
    pageSettings,
    chartConfigs,
    entryTags,
  }

  return JSON.stringify(data, null, 2)
}

export async function downloadJson(prefix: 'timeline-export' | 'timeline-backup') {
  const json = await exportAllData()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Import ----

async function importData(jsonString: string): Promise<void> {
  const raw: unknown = JSON.parse(jsonString)
  if (!isObject(raw)) throw new Error('Invalid export file: expected JSON object')

  const version = raw.version
  if (!isNumber(version) || version < 18) {
    throw new Error(`Unsupported export version: ${version}. Re-export from the app.`)
  }

  const pages = validateArray(raw.pages, validatePage)
  const tabs = validateArray(raw.tabs, validateTab)
  const blocks = validateArray(raw.blocks, validateBlock)
  const timelineEntries = validateArray(raw.timelineEntries, validateTimelineEntry)
  const pageSettings = validateArray(raw.pageSettings, validatePageSetting)
  const chartConfigs = validateArray(raw.chartConfigs, validateChartConfig)
  const entryTags = validateArray(raw.entryTags, validateEntryTag)

  if (pages.length === 0) {
    throw new Error('Invalid export file: no valid pages found')
  }

  // Sanitize HTML content
  const purify = await awaitPurify()
  sanitizeHtml(timelineEntries, purify)
  sanitizeHtml(blocks, purify)

  // Run everything in a transaction so failure rolls back
  await db.transaction('rw',
    [db.pages, db.layouts, db.blocks, db.timelineEntries, db.pageSettings, db.chartConfigs, db.entryTags],
    async () => {
      await Promise.all([
        db.pages.clear(),
        db.layouts.clear(),
        db.blocks.clear(),
        db.timelineEntries.clear(),
        db.pageSettings.clear(),
        db.chartConfigs.clear(),
        db.entryTags.clear(),
      ])
      await Promise.all([
        db.pages.bulkAdd(pages),
        db.layouts.bulkAdd(tabs),
        db.blocks.bulkAdd(blocks),
        db.timelineEntries.bulkAdd(timelineEntries),
        pageSettings.length > 0 ? db.pageSettings.bulkAdd(pageSettings) : Promise.resolve(),
        chartConfigs.length > 0 ? db.chartConfigs.bulkAdd(chartConfigs) : Promise.resolve(),
        entryTags.length > 0 ? db.entryTags.bulkAdd(entryTags) : Promise.resolve(),
      ])
    }
  )
}

// ---- Merge Import ----

async function mergeImportData(jsonString: string, targetPageId: number): Promise<string> {
  const raw: unknown = JSON.parse(jsonString)
  if (!isObject(raw)) throw new Error('Invalid file: expected JSON object')

  const timelineEntries = validateArray(raw.timelineEntries, validateTimelineEntry)

  if (timelineEntries.length === 0) {
    throw new Error('File contains no timeline entries to merge')
  }

  const targetPage = await db.pages.get(targetPageId)
  if (!targetPage) {
    throw new Error(`Target page with id ${targetPageId} does not exist`)
  }

  // Sanitize HTML content
  const purify = await awaitPurify()
  sanitizeHtml(timelineEntries, purify)

  const now = new Date()

  // Reassign all entries to target page, strip IDs for new records
  const preparedEntries = timelineEntries.map((e) => ({
    pageId: targetPageId,
    date: e.date,
    text: e.text,
    tagRefs: e.tagRefs,
    isPending: e.isPending,
    createdAt: e.createdAt ?? now,
    updatedAt: e.updatedAt ?? now,
  }))

  await db.transaction('rw', [db.timelineEntries], async () => {
    if (preparedEntries.length > 0) {
      await db.timelineEntries.bulkAdd(preparedEntries)
    }
  })

  return `Merged ${preparedEntries.length} timeline ${preparedEntries.length === 1 ? 'entry' : 'entries'}`
}

// ---- File Picker UI ----

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      resolve(input.files?.[0] ?? null)
    }
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

export async function triggerImport(): Promise<void> {
  const file = await pickFile()
  if (!file) return
  const text = await file.text()
  await importData(text)
}

export async function triggerMergeImport(targetPageId: number): Promise<string> {
  const file = await pickFile()
  if (!file) return ''
  const text = await file.text()
  return mergeImportData(text, targetPageId)
}
