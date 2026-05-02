import { useMemo, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { AppProvider, useAppContext } from './hooks/useAppContext'
import { AutocompleteProvider, useAutocomplete } from './hooks/useAutocomplete'
import { FeedbackForm } from './components/FeedbackForm/FeedbackForm'
import { PageForm, type PageFormData, type HubInfo } from './components/PageForm/PageForm'
import { SettingsModal } from './pages/SettingsPage/SettingsModal'
import { HelpModal } from './components/HelpModal/HelpModal'
import { ToastContainer } from './components/Toast/Toast'
import { useToast } from './hooks/useToast'
import { usePageActions, usePageByRole, getPagePath } from './hooks/usePages'
import { db } from './db/database'
import type { PageType, PageRole } from './types'
import { ROLE_TO_PAGE_TYPE } from './types'
import { RootPage } from './pages/RootPage/RootPage'
import { HubPage } from './pages/HubPage/HubPage'
import { DetailPage } from './pages/DetailPage/DetailPage'

function GlobalOverlays() {
  const {
    feedbackOpen, setFeedbackOpen,
    addPageOpen, setAddPageOpen,
    settingsOpen, setSettingsOpen,
    helpOpen, setHelpOpen,
  } = useAppContext()
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
      const pageId = await addPage({ name: data.name, type: 'hub', description: '' })
      await db.blocks.add({ pageId, type: 'visualization', order: 0 })
      await db.blocks.add({ pageId, type: 'table', order: 1 })
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

    const pageId = await addPage({ name: data.name, type: pageType, parentId, description: '' })

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
      <FeedbackForm open={feedbackOpen} onClose={() => setFeedbackOpen(false)} onSuccess={showToast} />
      <PageForm
        open={addPageOpen}
        onClose={() => setAddPageOpen(false)}
        onSubmit={handleAddPage}
        hubs={hubs}
        initial={{ parentHubId: defaultParentHubId }}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onToast={showToast} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
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

/** Auto-create default structural pages on fresh install */
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

      // Structural hubs
      await createHub('People', 'colleague-hub', '@')
      await createHub('Projects', 'project-hub', '#')
      await createHub('Candidates', 'candidate-hub', '%')

      // Generic hubs
      await createHub('Meetings', undefined, '!')

      // Standalone pages
      const adminId = await db.pages.add({
        ...base, name: 'Admin', type: 'general' as const, mentionTrigger: '^',
      })
      await db.blocks.add({ pageId: adminId as number, type: 'visualization', order: 0 })
      await db.blocks.add({ pageId: adminId as number, type: 'timeline', order: 1 })

      const vizId = await db.pages.add({
        ...base, name: 'Visualization', type: 'general' as const,
      })
      await db.blocks.add({ pageId: vizId as number, type: 'visualization', order: 0 })
    })()
  }, [])
}

export default function App() {
  useEnsureDefaults()

  return (
    <BrowserRouter basename="/timeline-app">
      <AppProvider>
        <AutocompleteProvider>
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
        <GlobalOverlays />
        </AutocompleteProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
