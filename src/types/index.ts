// ---- Entity Types ----

export type PageType = 'general' | 'candidate' | 'colleague' | 'project' | 'hub'
export type PageRole = 'colleague-hub' | 'candidate-hub' | 'project-hub' | 'main-timeline'

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

export type BlockType = 'text' | 'timeline' | 'table' | 'visualization'

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
  tagSlugs?: string[] // entry tag slugs for classification (e.g. "meeting", "jira")
  isPending: boolean
  createdAt: Date
  updatedAt: Date
}

// ---- Entry Tags (global classification) ----

export interface EntryTag {
  id?: number
  name: string      // display name: "Meeting", "Jira", "Positive", "Negative"
  slug: string      // for matching/storage: "meeting", "jira", "pos", "neg"
  category: string  // chart category label: "Meeting", "Work with Ticket", etc.
  order: number
}

// ---- Chart Configuration ----

export type ChartSource = 'classify' | 'entries' | 'pages'
export type ChartGrouping = 'month' | 'weekday'
export type ChartType = 'bar' | 'line' | 'area' | 'pie'

export type ChartScope =
  | { type: 'global' }
  | { type: 'page'; pageId: number }
  | { type: 'hub'; hubId: number }

export interface ChartConfig {
  id?: number
  blockId: number
  name?: string
  source: ChartSource
  grouping: ChartGrouping
  chartType: ChartType
  scopes?: ChartScope[]
  categories?: string[]
  aggregateByHub?: boolean
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
