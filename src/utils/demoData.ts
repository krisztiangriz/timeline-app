import { db } from '../db/database'
import type { PageRole } from '../types'

// ---- Entry template pools per project ----

const ALPHA_ENTRIES = [
  'Reviewed API design docs for v2 endpoints',
  'Sprint planning — prioritised auth module tasks',
  'Deployed auth service to staging environment',
  'Fixed rate limiting bug in API gateway',
  'Database migration script for user permissions',
  'Code review for payment processing PR',
  'Set up monitoring dashboards for backend services',
  'Refactored error handling in REST controllers',
  'Pair programming session on caching layer',
  'Load testing the new search endpoint',
  'Documented API versioning strategy',
  'Resolved flaky integration tests in CI pipeline',
  'Architecture review for event-driven messaging',
  'Optimised database queries — reduced p95 latency by 40%',
  'Implemented retry logic for third-party API calls',
  'Security audit follow-up — patched 2 dependency vulnerabilities',
  'Set up feature flags for gradual rollout',
  'Migrated legacy endpoints to the new router',
  'Configured auto-scaling rules for production',
  'Updated OpenAPI spec with new endpoint schemas',
  'Investigated memory leak in background workers',
  'Added structured logging across all services',
  'Sprint retro — identified 3 improvement areas',
  'Backlog grooming session with product team',
  'Deployed hotfix for session expiry edge case',
  'Wrote unit tests for new validation middleware',
  'Benchmarked gRPC vs REST for internal service calls',
  'Onboarded new team member — walked through architecture',
  'Finalised data model for multi-tenancy support',
  'Release prep — changelog and deployment checklist',
]

const WEBSITE_ENTRIES = [
  'Design review for new landing page mockups',
  'Implemented responsive navigation component',
  'A/B test results for CTA placement — variant B wins',
  'Accessibility audit — fixed 12 contrast issues',
  'Built reusable card component with Storybook docs',
  'Performance profiling — reduced LCP from 3.2s to 1.8s',
  'Migrated CSS to design token system',
  'User testing session — 5 participants, 3 key insights',
  'Set up visual regression tests with Playwright',
  'Implemented dark mode toggle with persistent preference',
  'Rebuilt footer layout for mobile breakpoints',
  'Content audit — identified 8 outdated pages',
  'Integrated analytics tracking for conversion funnel',
  'Built animated hero section with scroll-triggered effects',
  'Cross-browser testing — fixed Safari flexbox issue',
  'Optimised image pipeline — WebP with fallbacks',
  'Redesigned pricing page based on user feedback',
  'Implemented skeleton loading states across all pages',
  'Set up Lighthouse CI checks in PR pipeline',
  'Collaborated with brand team on updated colour palette',
  'Deployed staging preview for stakeholder review',
  'Fixed hydration mismatch in server-rendered pages',
  'Added breadcrumb navigation for deeper page hierarchy',
  'Sprint demo — presented redesigned dashboard to team',
  'Wrote e2e tests for checkout flow',
  'Reviewed and merged 4 community PRs',
  'Updated sitemap and robots.txt for SEO',
  'Prototyped new search UI with autocomplete',
  'Documented component API and usage guidelines',
  'Launched redesigned homepage to production',
]

const Q4_ENTRIES = [
  'Quarterly OKR drafting session with leadership',
  'Budget review for Q4 initiatives',
  'Stakeholder alignment meeting — agreed on 3 key priorities',
  'Competitive analysis of recent market entrants',
  'Drafted project proposal for infrastructure modernisation',
  'Resource allocation planning across 4 teams',
  'Risk assessment for Q4 delivery timeline',
  'Workshop on team velocity and capacity planning',
  'Defined success metrics for Q4 product launches',
  'Reviewed vendor contracts — renegotiated 2 renewals',
  'Created Q4 roadmap presentation for board review',
  'Aligned engineering and product on feature priorities',
  'Planned hiring pipeline for 2 senior roles',
  'Sprint planning for first Q4 initiative',
  'Set up project tracking board with milestones',
  'Kick-off meeting for data platform migration',
  'Identified 3 technical debt items blocking Q4 goals',
  'Weekly sync with external partners on integration work',
  'Drafted comms plan for upcoming product announcement',
  'Reviewed analytics data to inform Q4 feature decisions',
  'Cross-team dependency mapping session',
  'Prepared Q3 retrospective summary for exec team',
  'Finalised scope for Q4 security hardening sprint',
  'One-on-ones with team leads to gather Q4 input',
  'Updated project charter with revised timelines',
  'Facilitated pre-mortem exercise for launch readiness',
  'Coordinated with marketing on Q4 campaign timeline',
  'Documented decision log for architecture trade-offs',
  'Set up weekly progress reports for Q4 initiatives',
  'End-of-week check-in — all Q4 workstreams on track',
]

// ---- Wave intensity functions (0.0 to 1.0) ----

/** Alpha: peak months 0-3, taper 4-5, low 6-11 */
function alphaIntensity(monthIndex: number): number {
  if (monthIndex <= 3) return 1.0
  if (monthIndex === 4) return 0.5
  if (monthIndex === 5) return 0.25
  return 0.05
}

/** Website: low 0-1, ramp 2-3, peak 4-7, taper 8, low 9-11 */
function websiteIntensity(monthIndex: number): number {
  if (monthIndex <= 1) return 0.05
  if (monthIndex === 2) return 0.3
  if (monthIndex === 3) return 0.6
  if (monthIndex >= 4 && monthIndex <= 7) return 1.0
  if (monthIndex === 8) return 0.4
  return 0.05
}

/** Q4 Planning: low 0-5, ramp 6-7, peak 8-11 */
function q4Intensity(monthIndex: number): number {
  if (monthIndex <= 5) return 0.05
  if (monthIndex === 6) return 0.3
  if (monthIndex === 7) return 0.6
  return 1.0
}

// ---- Deterministic pseudo-random from seed ----

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49271
  return x - Math.floor(x)
}

// ---- Date helpers ----

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

// ---- Generate entries for a single project ----

function generateEntries(
  pageId: number,
  templates: string[],
  intensityFn: (monthIndex: number) => number,
  projectSeed: number,
): Array<{
  pageId: number
  date: Date
  text: string
  tagRefs: string[]
  isPending: boolean
  isCompleted: boolean
  ticketId: null
  createdAt: Date
  updatedAt: Date
}> {
  const entries: Array<{
    pageId: number
    date: Date
    text: string
    tagRefs: string[]
    isPending: boolean
    isCompleted: boolean
    ticketId: null
    createdAt: Date
    updatedAt: Date
  }> = []
  const now = new Date()
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  let templateIdx = 0
  let seed = projectSeed

  for (let m = 0; m < 12; m++) {
    const monthStart = startOfMonth(addDays(twelveMonthsAgo, m * 30))
    const intensity = intensityFn(m)

    // Number of entries per week at this intensity: 0-3
    const entriesPerWeek = Math.round(intensity * 3)

    // ~4 weeks per month
    for (let w = 0; w < 4; w++) {
      const weekStart = addDays(monthStart, w * 7)

      for (let e = 0; e < entriesPerWeek; e++) {
        seed++
        // Spread across weekdays (Mon-Fri), with some jitter
        const dayOffset = Math.floor(seededRandom(seed) * 5)
        const hour = 9 + Math.floor(seededRandom(seed + 1000) * 8) // 9am-5pm
        const minute = Math.floor(seededRandom(seed + 2000) * 60)

        const entryDate = addDays(weekStart, dayOffset)
        entryDate.setHours(hour, minute, 0, 0)

        // Don't create entries in the future
        if (entryDate > now) continue

        const text = templates[templateIdx % templates.length]
        templateIdx++

        entries.push({
          pageId,
          date: entryDate,
          text,
          tagRefs: [],
          isPending: false,
          isCompleted: false,
          ticketId: null,
          createdAt: entryDate,
          updatedAt: entryDate,
        })
      }
    }
  }

  return entries
}

// ---- Public API ----

/**
 * Seed demo data: 3 project pages under the Projects hub,
 * each with ~12 months of staggered timeline entries + chart configs.
 */
export async function seedDemoData() {
  const allPages = await db.pages.toArray()
  const projectsHub = allPages.find((p) => p.role === 'project-hub')
  if (!projectsHub?.id) return

  const hubId = projectsHub.id
  const now = new Date()
  const base = { description: '', createdAt: now, updatedAt: now, editCount: 0 }

  // Create 3 project pages
  const projects = [
    { name: 'Alpha Project', templates: ALPHA_ENTRIES, intensityFn: alphaIntensity, seed: 1000 },
    { name: 'Website Redesign', templates: WEBSITE_ENTRIES, intensityFn: websiteIntensity, seed: 2000 },
    { name: 'Q4 Planning', templates: Q4_ENTRIES, intensityFn: q4Intensity, seed: 3000 },
  ]

  const allEntries: Array<{
    pageId: number
    date: Date
    text: string
    tagRefs: string[]
    isPending: boolean
    isCompleted: boolean
    ticketId: null
    createdAt: Date
    updatedAt: Date
  }> = []

  const projectPageIds: number[] = []

  for (const project of projects) {
    const pageId = await db.pages.add({
      ...base,
      name: project.name,
      type: 'general' as const,
      parentId: hubId,
    })
    const pid = pageId as number
    projectPageIds.push(pid)

    // Create blocks: visualization + timeline
    const vizBlockId = await db.blocks.add({ pageId: pid, type: 'visualization', order: 0 })
    await db.blocks.add({ pageId: pid, type: 'timeline', order: 1 })

    // Chart config for this project's viz block
    await db.chartConfigs.add({
      blockId: vizBlockId as number,
      name: 'Activity',
      dataSource: 'entry-count',
      chartType: 'bar',
      scopes: [{ type: 'page', pageId: pid }],
      order: 0,
    })

    // Generate entries
    const entries = generateEntries(pid, project.templates, project.intensityFn, project.seed)
    allEntries.push(...entries)
  }

  // Bulk insert all entries
  await db.timelineEntries.bulkAdd(allEntries)

  // Add a hub-level stacked bar chart to the Projects hub's visualization block
  const hubBlocks = await db.blocks.where('pageId').equals(hubId).toArray()
  const hubVizBlock = hubBlocks.find((b) => b.type === 'visualization')
  if (hubVizBlock?.id) {
    await db.chartConfigs.add({
      blockId: hubVizBlock.id,
      name: 'Projects Overview',
      dataSource: 'entry-count',
      chartType: 'bar',
      scopes: [{ type: 'hub', hubId }],
      order: 0,
    })
  }
}

/**
 * Purge all data and recreate default structural pages.
 * After calling this, the app should be in a clean state.
 */
export async function purgeDemoData() {
  // Clear all data tables
  const tables = [
    db.pages, db.blocks, db.layouts, db.timelineEntries,
    db.feedbacks, db.dimensions, db.pageSettings, db.chartConfigs, db.tags,
  ]
  await db.transaction('rw', tables, async () => {
    await db.pages.clear()
    await db.blocks.clear()
    await db.layouts.clear()
    await db.timelineEntries.clear()
    await db.feedbacks.clear()
    await db.dimensions.clear()
    await db.pageSettings.clear()
    await db.chartConfigs.clear()
    await db.tags.clear()
  })

  // Recreate default structural pages (same as useEnsureDefaults)
  const now = new Date()
  const base = { description: '', createdAt: now, updatedAt: now, editCount: 0 }

  async function createHub(name: string, role?: PageRole, trigger?: string) {
    const pageId = await db.pages.add({
      ...base, name, type: 'hub' as const,
      ...(role ? { role } : {}),
      ...(trigger ? { mentionTrigger: trigger } : {}),
    })
    await db.blocks.add({ pageId: pageId as number, type: 'visualization', order: 0 })
    await db.blocks.add({ pageId: pageId as number, type: 'table', order: 1 })
  }

  // Main timeline
  const timelineId = await db.pages.add({
    ...base, name: 'Timeline', type: 'general' as const, role: 'main-timeline',
  })
  await db.blocks.add({ pageId: timelineId as number, type: 'timeline', order: 0 })

  // Visualization page
  const vizId = await db.pages.add({
    ...base, name: 'Visualization', type: 'general' as const,
  })
  await db.blocks.add({ pageId: vizId as number, type: 'visualization', order: 0 })

  // Projects hub
  await createHub('Projects', 'project-hub', '#')

  // Clear demo mode flag
  localStorage.removeItem('demo-mode')
  // Ensure onboarding won't re-show
  localStorage.setItem('onboarding-completed', 'true')
}
