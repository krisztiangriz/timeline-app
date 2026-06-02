import { useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { AppProvider, useModalContext, useMentionInsertContext } from './hooks/useAppContext'
import { AutocompleteProvider, useAutocomplete } from './hooks/useAutocomplete'
import { OnboardingGuidesProvider, useOnboardingActions } from './hooks/useOnboardingGuides'
import { ToastContainer } from './components/Toast/Toast'
import { ToastProvider, useToast } from './hooks/useToast'
import { useAutoBackup } from './hooks/useAutoBackup'
import { addPage, usePageByRole, getPagePath } from './hooks/usePages'
import { seedDefaultPropertyValues } from './hooks/useHubProperties'
import { initializeTheme } from './hooks/useTheme'
import { safeSetItem } from './utils/safeStorage'
import { db } from './db/database'
import type { PageType, PageRole } from './types'
import type { PageFormData, HubInfo } from './components/PageForm/PageForm'
import { ROLE_TO_PAGE_TYPE } from './types'
import { onboardingGuides } from './config/onboardingGuides'

// Apply theme immediately (before first render) to avoid flash
initializeTheme()

// Lazy-loaded route components
const RootPage = lazy(() => import('./pages/RootPage/RootPage').then((m) => ({ default: m.RootPage })))
const HubPage = lazy(() => import('./pages/HubPage/HubPage').then((m) => ({ default: m.HubPage })))
const DetailPage = lazy(() => import('./pages/DetailPage/DetailPage').then((m) => ({ default: m.DetailPage })))

// Lazy-loaded modal components
const PageForm = lazy(() => import('./components/PageForm/PageForm').then((m) => ({ default: m.PageForm })))
const FeedbackModal = lazy(() => import('./components/FeedbackModal/FeedbackModal').then((m) => ({ default: m.FeedbackModal })))
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
    addPageInitial, setAddPageInitial,
  } = useModalContext()
  const { setPendingMentionInsert } = useMentionInsertContext()
  const { toasts, show: showToast } = useToast()
  const { allPages } = useAutocomplete()
  const navigate = useNavigate()
  const location = useLocation()

  // Register all onboarding guide definitions centrally
  const { registerGuide } = useOnboardingActions()
  useEffect(() => { onboardingGuides.forEach(registerGuide) }, [registerGuide])

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
    const match = hubs.find((h) =>
      (h.role === 'colleague-hub' && path.startsWith('/colleagues')) ||
      (h.role === 'candidate-hub' && path.startsWith('/candidates')) ||
      (h.role === 'project-hub' && path.startsWith('/projects'))
    )
    return match?.id
  }, [hubs, location.pathname])

  async function handleAddPage(data: PageFormData): Promise<number | undefined> {
    const parentId = data.parentHubId
    const hub = parentId ? allPages.find((p) => p.id === parentId) : undefined

    // Hub creation — hub already exists (created by PageForm), just navigate
    if (data.isHub) {
      const pageId = data.existingPageId!
      setAddPageOpen(false)
      showToast('Hub created')
      safeSetItem('user-created-page', 'true')
      navigate(`/page/${pageId}`)
      return pageId
    }

    try {
      // Page creation — determine page type from parent hub
      let pageType: PageType = 'general'
      if (hub?.role && ROLE_TO_PAGE_TYPE[hub.role]) {
        pageType = ROLE_TO_PAGE_TYPE[hub.role]
      }

      const pageId = await addPage({ name: data.name, type: pageType, parentId, description: '', mentionTrigger: data.mentionTrigger, mentionCollapsed: data.mentionCollapsed })

      // Seed default property values if the parent hub has properties defined
      if (parentId) {
        await seedDefaultPropertyValues(pageId, parentId)
      }

      // Create tabs + blocks from the form data
      for (let i = 0; i < data.tabs.length; i++) {
        const tab = data.tabs[i]
        const tabId = await db.layouts.add({ pageId, type: 'tab' as const, name: tab.name, order: i })
        await db.blocks.add({ pageId, tabId: tabId as number, type: tab.type, ...(tab.type === 'text' ? { content: '' } : {}) })
      }

      setAddPageOpen(false)
      showToast('Page created')
      safeSetItem('user-created-page', 'true')

      // If page was created from trigger dropdown, insert mention instead of navigating
      if (addPageInitial?.triggerText) {
        setPendingMentionInsert({
          pageId,
          name: data.name,
          prefix: addPageInitial.triggerPrefix || '',
          triggerText: addPageInitial.triggerText,
        })
        setAddPageInitial(undefined)
      } else {
        setAddPageInitial(undefined)
        const newPage = await db.pages.get(pageId)
        if (newPage) {
          navigate(getPagePath(newPage, allPages))
        } else {
          navigate(`/page/${pageId}`)
        }
      }
    } catch {
      showToast('Failed to create page')
    }
    return undefined
  }

  return (
    <>
      {addPageOpen && (
        <Suspense fallback={null}>
          <PageForm
            open={addPageOpen}
            onClose={() => { setAddPageOpen(false); setAddPageInitial(undefined) }}
            onSubmit={handleAddPage}
            hubs={hubs}
            initial={{ parentHubId: addPageInitial?.parentHubId ?? defaultParentHubId, name: addPageInitial?.name }}
          />
        </Suspense>
      )}
      {feedbackOpen && <Suspense fallback={null}><FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} onSuccess={showToast} /></Suspense>}
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

/** Auto-create default structural pages on fresh install (idempotent, atomic) */
function useEnsureDefaults() {
  useEffect(() => {
    ;(async () => {
      try {
      // Clean up any orphaned draft pages (from crashes during hub creation)
      const drafts = await db.pages.filter((p) => !!p.isDraft).toArray()
      if (drafts.length > 0) {
        await db.pages.bulkDelete(drafts.map((p) => p.id!))
      }

      const existingPages = await db.pages.toArray()
      if (existingPages.length > 0) return // not a fresh install

      await db.transaction('rw', [db.pages, db.blocks], async () => {
        // Double-check inside transaction (race protection)
        const pages = await db.pages.toArray()
        if (pages.length > 0) return

        const now = new Date()
        const base = { description: '', createdAt: now, updatedAt: now, editCount: 0 }

        async function createHub(name: string, role?: PageRole, trigger?: string) {
          const pageId = await db.pages.add({
            ...base, name, type: 'hub' as const,
            ...(role ? { role } : {}),
            ...(trigger ? { mentionTrigger: trigger } : {}),
          })
          await db.blocks.add({ pageId: pageId as number, type: 'visualization' })
          await db.blocks.add({ pageId: pageId as number, type: 'table' })
        }

        // Main timeline
        const timelineId = await db.pages.add({
          ...base, name: 'Timeline', type: 'general' as const, role: 'main-timeline',
        })
        await db.blocks.add({ pageId: timelineId as number, type: 'timeline' })

        // Visualization page
        const vizId = await db.pages.add({
          ...base, name: 'Visualization', type: 'general' as const,
        })
        await db.blocks.add({ pageId: vizId as number, type: 'visualization' })

        // Projects hub
        await createHub('Projects', 'project-hub', '#')
      })
      } catch {
        // IndexedDB unavailable or migration failed — app will show empty state
      }
    })()
  }, [])
}

/** Listens for storage-unavailable events and shows a one-time toast */
function StorageWarningListener() {
  const { show: showToast } = useToast()
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast
  useEffect(() => {
    function handleStorageUnavailable() {
      showToastRef.current('Storage unavailable — preferences won\'t persist')
    }
    window.addEventListener('storage-unavailable', handleStorageUnavailable)
    return () => window.removeEventListener('storage-unavailable', handleStorageUnavailable)
  }, [])
  return null
}

/** Listens for backup events and shows toast notifications */
function BackupToastListener() {
  const { show: showToast } = useToast()
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast
  useEffect(() => {
    const onSuccess = () => showToastRef.current('Backup saved')
    const onFailed = () => showToastRef.current('Backup failed — export manually from Settings')
    window.addEventListener('backup-success', onSuccess)
    window.addEventListener('backup-failed', onFailed)
    return () => {
      window.removeEventListener('backup-success', onSuccess)
      window.removeEventListener('backup-failed', onFailed)
    }
  }, [])
  return null
}

export default function App() {
  useEnsureDefaults()
  useAutoBackup()

  return (
    <BrowserRouter basename="/timeline-app">
      <AppProvider>
        <AutocompleteProvider>
        <OnboardingGuidesProvider>
        <ToastProvider>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <StorageWarningListener />
        <BackupToastListener />
        <Suspense fallback={null}>
        <main id="main-content">
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
        </main>
        </Suspense>
        <GlobalOverlays />
        </ToastProvider>
        </OnboardingGuidesProvider>
        </AutocompleteProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
