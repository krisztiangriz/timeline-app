import { useMemo, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { AppProvider, useModalContext } from './hooks/useAppContext'
import { AutocompleteProvider, useAutocomplete } from './hooks/useAutocomplete'
import { ToastContainer } from './components/Toast/Toast'
import { ToastProvider, useToast } from './hooks/useToast'
import { useAutoBackup } from './hooks/useAutoBackup'
import { usePageActions, usePageByRole, getPagePath } from './hooks/usePages'
import { db } from './db/database'
import type { PageType, PageRole } from './types'
import type { PageFormData, HubInfo } from './components/PageForm/PageForm'
import { ROLE_TO_PAGE_TYPE } from './types'

// Lazy-loaded route components
const RootPage = lazy(() => import('./pages/RootPage/RootPage').then((m) => ({ default: m.RootPage })))
const HubPage = lazy(() => import('./pages/HubPage/HubPage').then((m) => ({ default: m.HubPage })))
const DetailPage = lazy(() => import('./pages/DetailPage/DetailPage').then((m) => ({ default: m.DetailPage })))

// Lazy-loaded modal components
const FeedbackForm = lazy(() => import('./components/FeedbackForm/FeedbackForm').then((m) => ({ default: m.FeedbackForm })))
const PageForm = lazy(() => import('./components/PageForm/PageForm').then((m) => ({ default: m.PageForm })))
const SettingsModal = lazy(() => import('./pages/SettingsPage/SettingsModal').then((m) => ({ default: m.SettingsModal })))
const HelpModal = lazy(() => import('./components/HelpModal/HelpModal').then((m) => ({ default: m.HelpModal })))
const OnboardingModal = lazy(() => import('./components/OnboardingModal/OnboardingModal').then((m) => ({ default: m.OnboardingModal })))

function GlobalOverlays() {
  const {
    feedbackOpen, setFeedbackOpen,
    addPageOpen, setAddPageOpen,
    settingsOpen, setSettingsOpen,
    helpOpen, setHelpOpen,
    onboardingOpen, setOnboardingOpen,
  } = useModalContext()
  const { toasts, show: showToast } = useToast()
  const { allPages } = useAutocomplete()
  const { addPage } = usePageActions()
  const navigate = useNavigate()
  const location = useLocation()

  // Build hubs list for PageForm
  const hubs = useMemo<HubInfo[]>(() =>
    allPages
      .filter((p) => p.type === 'hub')
      .map((p) => ({ id: p.id!, name: p.name, mentionTrigger: p.mentionTrigger, role: p.role })),
    [allPages]
  )

  // Auto-select hub based on current URL
  const defaultParentHubId = useMemo(() => {
    const path = location.pathname
    const match = hubs.find((h) => {
      const hub = allPages.find((p) => p.id === h.id)
      return (hub?.role === 'colleague-hub' && path.startsWith('/colleagues')) ||
        (hub?.role === 'candidate-hub' && path.startsWith('/candidates')) ||
        (hub?.role === 'project-hub' && path.startsWith('/projects'))
    })
    return match?.id
  }, [hubs, allPages, location.pathname])

  async function handleAddPage(data: PageFormData) {
    const parentId = data.parentHubId
    const hub = parentId ? allPages.find((p) => p.id === parentId) : undefined

    // Hub creation
    if (data.isHub) {
      const pageId = await addPage({ name: data.name, type: 'hub', description: '', mentionTrigger: data.mentionTrigger })
      if (data.template !== 'hub-table') {
        await db.blocks.add({ pageId, type: 'visualization', order: 0 })
      }
      await db.blocks.add({ pageId, type: 'table', order: data.template === 'hub-table' ? 0 : 1 })
      setAddPageOpen(false)
      showToast('Hub created')
      navigate(`/page/${pageId}`)
      return
    }

    // Page creation — determine page type from parent hub
    let pageType: PageType = 'general'
    if (hub?.role && ROLE_TO_PAGE_TYPE[hub.role]) {
      pageType = ROLE_TO_PAGE_TYPE[hub.role]
    }

    const pageId = await addPage({ name: data.name, type: pageType, parentId, description: '', mentionTrigger: data.mentionTrigger })

    // Create blocks/tabs based on selected template
    switch (data.template) {
      case 'tabbed': {
        const tabDefs = [
          { name: 'Timeline', blockType: 'timeline' as const },
          { name: 'Feedback', blockType: 'feedback' as const },
          { name: 'Visualization', blockType: 'visualization' as const },
        ]
        for (let i = 0; i < tabDefs.length; i++) {
          const tabId = await db.layouts.add({ pageId, type: 'tab' as const, name: tabDefs[i].name, order: i })
          await db.blocks.add({ pageId, tabId: tabId as number, type: tabDefs[i].blockType, order: 0 })
        }
        // Append user-added extra tabs
        for (let i = 0; i < data.tabs.length; i++) {
          const tabId = await db.layouts.add({ pageId, type: 'tab' as const, name: data.tabs[i], order: tabDefs.length + i })
          await db.blocks.add({ pageId, tabId: tabId as number, type: 'text', content: '', order: 0 })
        }
        break
      }
      case 'simple':
        await db.blocks.add({ pageId, type: 'visualization', order: 0 })
        await db.blocks.add({ pageId, type: 'timeline', order: 1 })
        break
      case 'text':
        await db.blocks.add({ pageId, type: 'text', content: '', order: 0 })
        break
      case 'custom':
        // Empty — user configures after creation
        break
    }

    setAddPageOpen(false)
    showToast('Page created')

    const newPage = await db.pages.get(pageId)
    if (newPage) {
      navigate(getPagePath(newPage, allPages))
    } else {
      navigate(`/page/${pageId}`)
    }
  }

  return (
    <>
      {feedbackOpen && <Suspense fallback={null}><FeedbackForm open={feedbackOpen} onClose={() => setFeedbackOpen(false)} onSuccess={showToast} /></Suspense>}
      {addPageOpen && (
        <Suspense fallback={null}>
          <PageForm
            open={addPageOpen}
            onClose={() => setAddPageOpen(false)}
            onSubmit={handleAddPage}
            hubs={hubs}
            initial={{ parentHubId: defaultParentHubId }}
          />
        </Suspense>
      )}
      {settingsOpen && <Suspense fallback={null}><SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onToast={showToast} /></Suspense>}
      {helpOpen && <Suspense fallback={null}><HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} /></Suspense>}
      {onboardingOpen && <Suspense fallback={null}><OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} /></Suspense>}
      <ToastContainer toasts={toasts} />
    </>
  )
}

/** Resolve /timeline to the main-timeline page */
function TimelineRedirect() {
  const page = usePageByRole('main-timeline')
  if (!page) return null
  return <Navigate to={`/page/${page.id}`} replace />
}

let defaultsInitialized = false

/** Auto-create default structural pages on fresh install, then seed demo data */
function useEnsureDefaults() {
  useEffect(() => {
    if (defaultsInitialized) return
    defaultsInitialized = true

    ;(async () => {
      const allPages = await db.pages.toArray()
      if (allPages.length > 0) return // not a fresh install

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
    })()
  }, [])
}

export default function App() {
  useEnsureDefaults()
  useAutoBackup()

  return (
    <BrowserRouter basename="/timeline-app">
      <AppProvider>
        <AutocompleteProvider>
        <ToastProvider>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/timeline" element={<TimelineRedirect />} />
          <Route path="/colleagues" element={<HubPage role="colleague-hub" />} />
          <Route path="/colleagues/:id" element={<DetailPage routePrefix="colleagues" />} />
          <Route path="/candidates" element={<HubPage role="candidate-hub" />} />
          <Route path="/candidates/:id" element={<DetailPage routePrefix="candidates" />} />
          <Route path="/projects" element={<HubPage role="project-hub" />} />
          <Route path="/projects/:id" element={<DetailPage routePrefix="projects" />} />
          <Route path="/page/:id" element={<DetailPage />} />
        </Routes>
        </Suspense>
        <GlobalOverlays />
        </ToastProvider>
        </AutocompleteProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
