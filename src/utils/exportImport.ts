import { db } from '../db/database'
import type {
  Page,
  Tab,
  Block,
  TimelineEntry,
  PageSetting,
  ChartConfig,
  HubProperty,
  PagePropertyValue,
  RegexPattern,
  HubRegexAssignment,
} from '../types'

// ---- Export Format ----

const CURRENT_VERSION = 17

interface ExportData {
  version: typeof CURRENT_VERSION
  exportedAt: string
  pages: Page[]
  tabs: Tab[]
  blocks: Block[]
  timelineEntries: TimelineEntry[]
  pageSettings: PageSetting[]
  chartConfigs: ChartConfig[]
  hubProperties: HubProperty[]
  pagePropertyValues: PagePropertyValue[]
  regexPatterns: RegexPattern[]
  hubRegexAssignments: HubRegexAssignment[]
}

// ---- Enum allowlists (runtime guards — TypeScript casts are erased at runtime) ----

const VALID_PAGE_TYPES = new Set(['general', 'candidate', 'colleague', 'project', 'hub'])
const VALID_PAGE_ROLES = new Set(['colleague-hub', 'candidate-hub', 'project-hub', 'main-timeline'])
const VALID_BLOCK_TYPES = new Set(['text', 'timeline', 'table', 'visualization'])
const VALID_CHART_SOURCES = new Set(['regex', 'entries', 'pages', 'property'])
const VALID_CHART_GROUPINGS = new Set(['month', 'weekday', 'property-value'])
const VALID_CHART_TYPES = new Set(['bar', 'line', 'area', 'pie'])

function convertLegacyDataSource(dataSource: string): { source: string; grouping: string } | null {
  switch (dataSource) {
    case 'entry-count':
    case 'regex-count': return { source: 'regex', grouping: 'month' }
    case 'entry-by-weekday': return { source: 'entries', grouping: 'weekday' }
    case 'page-count': return { source: 'pages', grouping: 'month' }
    case 'property-distribution': return { source: 'property', grouping: 'property-value' }
    default: return null
  }
}

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
    description: isString(raw.description) ? raw.description : '',
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

  // Support legacy format: convert dataSource to source+grouping
  let source = raw.source as string | undefined
  let grouping = raw.grouping as string | undefined
  if (!source && isString(raw.dataSource)) {
    const converted = convertLegacyDataSource(raw.dataSource)
    if (!converted) return null
    source = converted.source
    grouping = converted.grouping
  }
  if (!isString(source) || !VALID_CHART_SOURCES.has(source)) return null
  if (!isString(grouping) || !VALID_CHART_GROUPINGS.has(grouping)) return null

  // Validate scopes structure
  let scopes: ChartConfig['scopes'] | undefined
  if (isArray(raw.scopes)) {
    const validScopes = (raw.scopes as unknown[]).filter((s) => {
      if (!isObject(s) || !isString((s as Record<string, unknown>).type)) return false
      const t = (s as Record<string, unknown>).type
      return t === 'global' || t === 'page' || t === 'hub'
    })
    scopes = validScopes.length > 0 ? validScopes as ChartConfig['scopes'] : undefined
  }
  // Handle regexPatternIds (new array) or legacy regexPatternId (singular)
  let regexPatternIds: number[] | undefined
  if (isArray(raw.regexPatternIds)) {
    const ids = (raw.regexPatternIds as unknown[]).filter(isNumber)
    if (ids.length > 0) regexPatternIds = ids
  } else if (isNumber(raw.regexPatternId)) {
    regexPatternIds = [raw.regexPatternId]
  }

  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    blockId: raw.blockId,
    name: isString(raw.name) ? raw.name : undefined,
    source: source as ChartConfig['source'],
    grouping: grouping as ChartConfig['grouping'],
    chartType: raw.chartType as ChartConfig['chartType'],
    scopes,
    propertyId: isNumber(raw.propertyId) ? raw.propertyId : undefined,
    regexPatternIds,
    aggregateByHub: raw.aggregateByHub === true ? true : undefined,
    order: isNumber(raw.order) ? raw.order : 0,
  }
}

function validateHubProperty(raw: unknown): HubProperty | null {
  if (!isObject(raw)) return null
  if (!isNumber(raw.hubId) || !isString(raw.name)) return null
  if (raw.scope === 'feedback') return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    hubId: raw.hubId,
    name: raw.name,
    type: 'select',
    options: isArray(raw.options) ? raw.options as HubProperty['options'] : [],
    order: isNumber(raw.order) ? raw.order : 0,
    scope: raw.scope === 'page' ? 'page' : undefined,
  }
}

function validatePagePropertyValue(raw: unknown): PagePropertyValue | null {
  if (!isObject(raw)) return null
  if (!isNumber(raw.pageId) || !isNumber(raw.propertyId) || !isString(raw.value)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    pageId: raw.pageId,
    propertyId: raw.propertyId,
    value: raw.value,
  }
}

function validateRegexPattern(raw: unknown): RegexPattern | null {
  if (!isObject(raw)) return null
  if (!isString(raw.name) || !isString(raw.pattern)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    name: raw.name,
    pattern: raw.pattern,
    order: isNumber(raw.order) ? raw.order : 0,
  }
}

function validateHubRegexAssignment(raw: unknown): HubRegexAssignment | null {
  if (!isObject(raw)) return null
  if (!isNumber(raw.hubId) || !isNumber(raw.regexPatternId)) return null
  return {
    ...(isNumber(raw.id) ? { id: raw.id } : {}),
    hubId: raw.hubId,
    regexPatternId: raw.regexPatternId,
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

// ---- Sanitization (lazy-loaded DOMPurify) ----

let purify: { sanitize: (html: string) => string } | null = null

async function loadPurify() {
  if (!purify) {
    const mod = await import('dompurify')
    purify = mod.default
  }
  return purify
}

function sanitizeHtml(records: { text?: string; content?: string; description?: string }[]): void {
  if (!purify) return
  for (const r of records) {
    if (typeof r.text === 'string') r.text = purify.sanitize(r.text)
    if (typeof r.content === 'string') r.content = purify.sanitize(r.content)
    if (typeof r.description === 'string') r.description = purify.sanitize(r.description)
  }
}

// ---- Export ----

async function exportAllData(): Promise<string> {
  const [pages, tabs, blocks, timelineEntries, pageSettings, chartConfigs, hubProperties, pagePropertyValues, regexPatterns, hubRegexAssignments] =
    await Promise.all([
      db.pages.toArray(),
      db.layouts.toArray(),
      db.blocks.toArray(),
      db.timelineEntries.toArray(),
      db.pageSettings.toArray(),
      db.chartConfigs.toArray(),
      db.hubProperties.toArray(),
      db.pagePropertyValues.toArray(),
      db.regexPatterns.toArray(),
      db.hubRegexAssignments.toArray(),
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
    hubProperties,
    pagePropertyValues,
    regexPatterns,
    hubRegexAssignments,
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

export async function downloadExport() {
  await downloadJson('timeline-export')
}

export async function downloadBackup() {
  await downloadJson('timeline-backup')
}

// ---- Import ----

async function importData(jsonString: string): Promise<void> {
  const raw: unknown = JSON.parse(jsonString)
  if (!isObject(raw)) throw new Error('Invalid export file: expected JSON object')

  // Accept version 12+ (old format with 'layouts' key) or 13+ (new format with 'tabs' key)
  const version = raw.version
  if (!isNumber(version) || version < 12) {
    throw new Error(`Unsupported export version: ${version}. Re-export from the app.`)
  }

  // Parse and validate all tables — old format uses 'layouts', new uses 'tabs'
  const tabsRaw = raw.tabs ?? raw.layouts
  const pages = validateArray(raw.pages, validatePage)
  const tabs = validateArray(tabsRaw, validateTab)
  const blocks = validateArray(raw.blocks, validateBlock)
  const timelineEntries = validateArray(raw.timelineEntries, validateTimelineEntry)
  const pageSettings = validateArray(raw.pageSettings, validatePageSetting)
  const chartConfigs = validateArray(raw.chartConfigs, validateChartConfig)
  const hubProperties = validateArray(raw.hubProperties, validateHubProperty)
  const pagePropertyValues = validateArray(raw.pagePropertyValues, validatePagePropertyValue)
  const regexPatterns = validateArray(raw.regexPatterns, validateRegexPattern)
  const hubRegexAssignments = validateArray(raw.hubRegexAssignments, validateHubRegexAssignment)

  if (pages.length === 0) {
    throw new Error('Invalid export file: no valid pages found')
  }

  // Compute hub set for pattern seeding
  const hubIds = new Set(pages.filter((p) => p.type === 'hub').map((p) => p.id!))
  const hubsWithChildren = new Set(pages.filter((p) => p.parentId && hubIds.has(p.parentId)).map((p) => p.parentId!))

  // Seed regex pattern for legacy entry-count charts (pre-v21 backups have no regexPatterns)
  const chartsNeedingPattern = chartConfigs.filter((c) => c.source === 'regex' && (!c.regexPatternIds || c.regexPatternIds.length === 0))
  if (chartsNeedingPattern.length > 0) {
    const existing = regexPatterns.find((p) => p.pattern === '.+')
    let patternId: number
    if (existing?.id) {
      patternId = existing.id
    } else {
      const maxId = Math.max(0, ...regexPatterns.map((p) => p.id ?? 0))
      const newPattern: RegexPattern = { id: maxId + 1, name: 'Entry count', pattern: '.+', order: 0 }
      regexPatterns.push(newPattern)
      patternId = newPattern.id!
    }
    for (const chart of chartsNeedingPattern) {
      chart.regexPatternIds = [patternId]
    }
    for (const hubId of hubsWithChildren) {
      if (!hubRegexAssignments.some((a) => a.hubId === hubId && a.regexPatternId === patternId)) {
        hubRegexAssignments.push({ hubId, regexPatternId: patternId })
      }
    }
  }

  // Convert legacy feedbacks to timeline entries
  const rawFeedbacks = isArray(raw.feedbacks) ? raw.feedbacks as Record<string, unknown>[] : []
  const rawDimensions = isArray(raw.dimensions) ? raw.dimensions as Record<string, unknown>[] : []

  if (rawFeedbacks.length > 0) {
    const dimensionMap = new Map<number, string>()
    for (const d of rawDimensions) {
      if (isNumber(d.id) && isString(d.name)) dimensionMap.set(d.id, d.name)
    }

    for (const fb of rawFeedbacks) {
      if (!isNumber(fb.subjectId) || !isString(fb.description)) continue
      const type = isString(fb.type) ? fb.type : 'neutral'
      const dimension = isNumber(fb.dimensionId) ? dimensionMap.get(fb.dimensionId) : undefined
      const prefix = dimension ? `[Feedback] [${type}] [${dimension}]` : `[Feedback] [${type}]`
      const date = toDate(fb.createdAt)
      timelineEntries.push({
        pageId: fb.subjectId,
        date,
        text: `${prefix} ${fb.description}`,
        tagRefs: [],
        isPending: false,
        createdAt: date,
        updatedAt: date,
      })
    }

    // Seed feedback regex patterns
    const feedbackPatterns = [
      { name: '[Feedback]', pattern: '\\[Feedback\\]' },
      { name: '[Positive]', pattern: '\\[positive\\]' },
      { name: '[Negative]', pattern: '\\[negative\\]' },
    ]
    let maxId = Math.max(0, ...regexPatterns.map((p) => p.id ?? 0))
    for (const fp of feedbackPatterns) {
      if (!regexPatterns.some((p) => p.pattern === fp.pattern)) {
        maxId++
        regexPatterns.push({ id: maxId, name: fp.name, pattern: fp.pattern, order: regexPatterns.length })
        for (const hubId of hubsWithChildren) {
          hubRegexAssignments.push({ hubId, regexPatternId: maxId })
        }
      }
    }
  }

  // Sanitize HTML content
  const DOMPurify = await loadPurify()
  if (DOMPurify) {
    sanitizeHtml(timelineEntries)
    sanitizeHtml(blocks)
  }

  // Run everything in a transaction so failure rolls back
  await db.transaction('rw',
    [db.pages, db.layouts, db.blocks, db.timelineEntries, db.pageSettings, db.chartConfigs, db.hubProperties, db.pagePropertyValues, db.regexPatterns, db.hubRegexAssignments],
    async () => {
      await Promise.all([
        db.pages.clear(),
        db.layouts.clear(),
        db.blocks.clear(),
        db.timelineEntries.clear(),
        db.pageSettings.clear(),
        db.chartConfigs.clear(),
        db.hubProperties.clear(),
        db.pagePropertyValues.clear(),
        db.regexPatterns.clear(),
        db.hubRegexAssignments.clear(),
      ])
      await Promise.all([
        db.pages.bulkAdd(pages),
        db.layouts.bulkAdd(tabs),
        db.blocks.bulkAdd(blocks),
        db.timelineEntries.bulkAdd(timelineEntries),
        pageSettings.length > 0 ? db.pageSettings.bulkAdd(pageSettings) : Promise.resolve(),
        chartConfigs.length > 0 ? db.chartConfigs.bulkAdd(chartConfigs) : Promise.resolve(),
        hubProperties.length > 0 ? db.hubProperties.bulkAdd(hubProperties) : Promise.resolve(),
        pagePropertyValues.length > 0 ? db.pagePropertyValues.bulkAdd(pagePropertyValues) : Promise.resolve(),
        regexPatterns.length > 0 ? db.regexPatterns.bulkAdd(regexPatterns) : Promise.resolve(),
        hubRegexAssignments.length > 0 ? db.hubRegexAssignments.bulkAdd(hubRegexAssignments) : Promise.resolve(),
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
  const DOMPurify = await loadPurify()
  if (DOMPurify) {
    sanitizeHtml(timelineEntries)
  }

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
