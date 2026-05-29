// ---- Entity Types ----

export type PageType = 'general' | 'candidate' | 'colleague' | 'project' | 'hub'
export type PageRole = 'colleague-hub' | 'candidate-hub' | 'project-hub' | 'main-timeline'

// ---- Hub Properties (configurable per hub) ----

export interface PropertyOption {
  value: string       // slug/key: "active", "engineer"
  label: string       // display label: "Active", "Engineer"
  color?: string      // hex color from palette
}

export interface HubProperty {
  id?: number
  hubId: number       // which hub owns this property
  name: string        // "Status", "Role", "Level"
  type: 'select'      // only select for now
  options: PropertyOption[]
  order: number
  scope?: 'page' | 'feedback'  // default 'page' for backward compat
}

export interface PagePropertyValue {
  id?: number
  pageId: number      // child page
  propertyId: number  // which HubProperty
  value: string       // matches a PropertyOption.value
}

// ---- Database Entities ----

export interface Page {
  id?: number
  name: string
  type: PageType
  role?: PageRole          // stable identifier for special pages (set on create)
  mentionTrigger?: string  // autocomplete trigger prefix — any single character for hubs
  mentionCollapsed?: boolean // when true, mentions show only the trigger char (not the full name)
  parentId?: number        // hub grouping
  archived?: boolean       // hidden from views unless "Show archived" is on
  isDraft?: boolean        // true for placeholder hubs being configured — excluded from queries
  description: string
  createdAt: Date
  updatedAt: Date
  editCount: number
}

export interface Tab {
  id?: number
  pageId: number
  type: 'tab'
  name: string
  order: number
}

export type BlockType = 'text' | 'timeline' | 'feedback' | 'table' | 'visualization'

export interface Block {
  id?: number
  pageId: number
  tabId?: number    // Tab.id for tab grouping, undefined = page-level (hubs, main-timeline only)
  type: BlockType
  content?: string  // HTML for text blocks
}

export interface PageSetting {
  id?: number
  pageKey: string   // e.g. "root", "colleague-hub", "page-123"
  sortKey: string   // "name" | "createdAt" | "updatedAt" | "editCount"
  sortDir: string   // "asc" | "desc"
}

export interface TimelineEntry {
  id?: number
  pageId: number // which page's timeline this belongs to
  date: Date
  text: string
  tagRefs: string[] // page IDs of mentioned pages (for cross-referencing)
  isPending: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Feedback {
  id?: number
  subjectId: number // pageId of colleague/project
  type: string      // first feedback property value (e.g. 'positive', 'neutral', 'negative')
  description: string
  dimensionId?: string  // second feedback property value (option slug from hub feedback property)
  createdAt: Date
}

// ---- Chart Configuration ----

export type ChartDataSource =
  | 'entry-count'
  | 'entry-by-weekday'
  | 'property-distribution'
  | 'page-count'
  | 'feedback-by-type'
  | 'feedback-by-dimension'
  | 'feedback-over-time'
  | 'feedback-per-page'

export type ChartType = 'bar' | 'line' | 'area' | 'pie'

export type ChartScope =
  | { type: 'global' }
  | { type: 'page'; pageId: number }
  | { type: 'hub'; hubId: number }

export interface ChartConfig {
  id?: number
  blockId: number
  name?: string
  dataSource: ChartDataSource
  chartType: ChartType
  scopes?: ChartScope[]       // multi-select scopes (empty = all data)
  propertyId?: number         // for 'property-distribution' source
  order: number
}

// ---- Constants ----

/** Map hub role → child page type */
export const ROLE_TO_PAGE_TYPE: Record<string, PageType> = {
  'colleague-hub': 'colleague',
  'candidate-hub': 'candidate',
  'project-hub': 'project',
}

// ---- UI Types ----

export interface BreadcrumbItem {
  label: string
  path: string
}
