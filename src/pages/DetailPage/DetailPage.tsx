import { useStickyScroll } from '../../hooks/useStickyScroll'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { BreadcrumbNav } from '../../components/Breadcrumb/Breadcrumb'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { PageForm, type PageFormData } from '../../components/PageForm/PageForm'
import { BlockRenderer } from '../../components/BlockRenderer/BlockRenderer'
import { usePage, usePageActions, usePageTabs, getPagePath } from '../../hooks/usePages'
import { usePageMenus } from '../../hooks/usePageMenus'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useToast } from '../../hooks/useToast'
import type { CandidateStatus } from '../../types'
import layout from '../../styles/layout.module.css'
import pd from '../../components/PageDetail/PageDetail.module.css'

const STATUS_OPTIONS: { value: CandidateStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

interface DetailPageProps {
  /** Route prefix for breadcrumb path, e.g. 'colleagues', 'projects', 'candidates'. If undefined, uses '/page/:id'. */
  routePrefix?: string
}

export function DetailPage({ routePrefix }: DetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const pageId = id ? Number(id) : undefined
  const page = usePage(pageId)
  const tabs = usePageTabs(pageId)
  const { updatePage, deletePage, updateTabs, archivePage, unarchivePage } = usePageActions()
  const { allPages } = useAutocomplete()
  const { show: showToast } = useToast()
  const { sentinelRef, isScrolled } = useStickyScroll()
  const [rearrangeMode, setRearrangeMode] = useState(false)
  const [editPageOpen, setEditPageOpen] = useState(false)
  const [activeTabId, setActiveTabId] = useState<number | null>(null)

  // Candidate status dropdown state
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  const tabIds = tabs.map(t => t.id).join(',')
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTabId)) setActiveTabId(tabs[0].id!)
    else if (tabs.length === 0) setActiveTabId(null)
  }, [tabIds, activeTabId]) // eslint-disable-line react-hooks/exhaustive-deps — tabs is derived from tabIds in the same render; using the string avoids re-runs on every Dexie live query emission

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusOpen) return
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [statusOpen])

  const parentHub = page?.parentId ? allPages.find((p) => p.id === page.parentId) : undefined
  const hubPath = parentHub ? getPagePath(parentHub, allPages) : '/'
  const pagePath = routePrefix ? `/${routePrefix}/${page?.id}` : `/page/${page?.id}`

  const protectedTabCount = parentHub?.role === 'colleague-hub' || parentHub?.role === 'project-hub'
    ? 3
    : 0

  const canDelete = !page?.role
  const isMainTimeline = page?.role === 'main-timeline'
  const canArchive = !isMainTimeline
  const isCandidate = page?.type === 'candidate'
  const currentStatus = STATUS_OPTIONS.find((o) => o.value === (page?.candidateStatus ?? 'active'))

  const handleArchive = useCallback(async () => {
    if (!pageId || !page) return
    if (page.archived) {
      await unarchivePage(pageId)
      showToast('Unarchived')
    } else {
      await archivePage(pageId)
      showToast('Archived')
    }
  }, [pageId, page, archivePage, unarchivePage, showToast])

  const { addMenuItems, moreMenuItems } = usePageMenus({
    pageId, canDelete, canArchive, isArchived: !!page?.archived,
    deleteRedirect: hubPath,
    onEditPage: isMainTimeline ? undefined : () => setEditPageOpen(true),
    onRearrange: isMainTimeline ? undefined : () => setRearrangeMode((v) => !v),
    onArchive: handleArchive,
    deletePage, pageName: page?.name, showToast,
  })

  const editInitial = useMemo(() => {
    const parentHub = page?.parentId ? allPages.find((p) => p.id === page.parentId) : undefined
    return {
      name: page?.name ?? '',
      tabs: tabs.map((l) => l.name),
      mentionTrigger: page?.mentionTrigger,
      mentionCollapsed: page?.mentionCollapsed,
      inheritedTrigger: parentHub?.mentionTrigger,
      inheritedFrom: parentHub?.name,
    }
  }, [page, tabs, allPages])

  async function handleEditSubmit(data: PageFormData) {
    if (!pageId) return
    await updatePage(pageId, { name: data.name, mentionTrigger: data.mentionTrigger, mentionCollapsed: data.mentionCollapsed })
    await updateTabs(pageId, data.tabs)
    setEditPageOpen(false); showToast('Page updated')
  }

  if (!page) return null

  return (
    <div className={layout.page}>
      <div className={layout.contentPadded}>
        <div ref={sentinelRef} />
        <div className={isScrolled ? layout.stickyHeaderScrolled : layout.stickyHeader}>
          <BreadcrumbNav items={[{ label: 'Home', path: '/' }, ...(parentHub ? [{ label: parentHub.name, path: hubPath }] : []), { label: page.name, path: pagePath }]} addMenuItems={addMenuItems} moreMenuItems={moreMenuItems} />
          {isCandidate ? (
            <div className={pd.titleRow}>
              <PageHeader name={page.name} onUpdateName={(name) => updatePage(pageId!, { name })} tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
              <div className={pd.statusDropdown} ref={statusRef}>
                <button className={pd.statusButton} onClick={() => setStatusOpen((v) => !v)}>
                  {currentStatus?.label ?? 'Active'}
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 10.5547L5.57031 7.125L4.44531 8.25L9 12.8047L13.5547 8.25L12.4297 7.125L9 10.5547Z" fill="currentColor" fillOpacity="0.7" />
                  </svg>
                </button>
                {statusOpen && (
                  <div className={pd.statusMenu}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={pd.statusMenuItem}
                        data-active={opt.value === (page.candidateStatus ?? 'active') || undefined}
                        onClick={() => { updatePage(pageId!, { candidateStatus: opt.value as CandidateStatus }); setStatusOpen(false) }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <PageHeader name={page.name} onUpdateName={(name) => updatePage(pageId!, { name })} tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} readOnly={isMainTimeline} />
          )}
        </div>
        <BlockRenderer page={page} rearrangeMode={rearrangeMode} activeTabId={activeTabId} />
      </div>
      <PageForm open={editPageOpen} onClose={() => setEditPageOpen(false)} onSubmit={handleEditSubmit} initial={editInitial} isEdit protectedTabCount={protectedTabCount} />
    </div>
  )
}
