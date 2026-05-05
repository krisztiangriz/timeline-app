// ---- Entity Types ----

export type PageType = 'general' | 'candidate' | 'colleague' | 'project' | 'hub'
export type PageRole = 'colleague-hub' | 'candidate-hub' | 'project-hub' | 'main-timeline'

export type FeedbackType = 'positive' | 'neutral' | 'negative'

export type CandidateStatus = 'active' | 'recommended' | 'hired' | 'rejected' | 'withdrawn'

// ---- Database Entities ----

export interface Page {
  id?: number
  name: string
  type: PageType
  role?: PageRole          // stable identifier for special pages (set on create)
  mentionTrigger?: string  // autocomplete trigger prefix — any single character for hubs
  mentionCollapsed?: boolean // when true, mentions show only the trigger char (not the full name)
  parentId?: number        // hub grouping
  candidateStatus?: CandidateStatus // only for candidate pages
  archived?: boolean       // hidden from views unless "Show archived" is on
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
  tabId?: number    // Tab.id for tab grouping, undefined = no tab
  type: BlockType
  content?: string  // HTML for text blocks
  order: number
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
  type: FeedbackType
  description: string
  dimensionId?: number
  createdAt: Date
}

export interface Dimension {
  id?: number
  name: string
  order: number
}

// ---- Chart Configuration ----

export type ChartDataSource =
  | 'entry-count'
  | 'feedback-sentiment'
  | 'feedback-by-dimension'
  | 'candidate-status'

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
