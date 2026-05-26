import { useStickyScroll } from '../../hooks/useStickyScroll'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BreadcrumbNav } from '../../components/Breadcrumb/Breadcrumb'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { usePreferences } from '../../hooks/useAppContext'
import {
  updatePage,
  buildFlatPageList,
  getPagePath,
} from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { usePageMenus } from '../../hooks/usePageMenus'
import { useTableSort } from '../../hooks/useTableSort'
import { useToast } from '../../hooks/useToast'
import { formatTableDate } from '../../utils/dateUtils'
import { ROLE_TO_PAGE_TYPE } from '../../types'
import type { PageType } from '../../types'
import { DragHandleIcon } from '../../components/Icons/Icons'
import { useOnboardingGuides } from '../../hooks/useOnboardingGuides'
import { OnboardingGuide } from '../../components/OnboardingGuide/OnboardingGuide'
import { safeGetItem } from '../../utils/safeStorage'
import layout from '../../styles/layout.module.css'
import table from '../../styles/table.module.css'

export function RootPage() {
  const { allPages } = useAutocomplete()
  const { showArchived } = usePreferences()
  const navigate = useNavigate()
  const { show: showToast } = useToast()
  const { toggleSort, sortPages, arrow } = useTableSort('root')

  const { sentinelRef, isScrolled } = useStickyScroll()
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dropTargetId, setDropTargetId] = useState<number | null>(null)

  // Sort pages then build tree, filtering archived unless showArchived
  const flatRows = useMemo(() => {
    const filtered = showArchived ? allPages : allPages.filter((p) => !p.archived)
    const sorted = sortPages(filtered)
    return buildFlatPageList(sorted)
  }, [allPages, sortPages, showArchived])

  // Onboarding: trigger home-intro guide when user has created pages
  const { triggerGuide } = useOnboardingGuides()
  const tableRef = useRef<HTMLDivElement>(null)
  const hasPages = flatRows.length > 0
  const onboardingDone = safeGetItem('onboarding-completed') === 'true'
  const userCreatedPage = safeGetItem('user-created-page') === 'true'
  useEffect(() => {
    if (hasPages && onboardingDone && userCreatedPage) triggerGuide('home-intro')
  }, [hasPages, onboardingDone, userCreatedPage, triggerGuide])

  const { moreMenuItems } = usePageMenus({})

  function handleDragStart(e: React.DragEvent, pageId: number) {
    setDraggedId(pageId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(pageId))
  }

  function handleDragEnd() { setDraggedId(null); setDropTargetId(null) }

  function handleDragOver(e: React.DragEvent, targetPageId: number) {
    const targetPage = allPages.find((p) => p.id === targetPageId)
    if (!targetPage || targetPage.type !== 'hub' || targetPageId === draggedId) return
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetId(targetPageId)
  }

  function handleDragLeave(e: React.DragEvent, targetPageId: number) {
    const related = e.relatedTarget as HTMLElement | null
    if (related && (e.currentTarget as HTMLElement).contains(related)) return
    if (dropTargetId === targetPageId) setDropTargetId(null)
  }

  async function handleDrop(e: React.DragEvent, targetPageId: number) {
    e.preventDefault()
    const dragId = Number(e.dataTransfer.getData('text/plain'))
    if (!dragId || dragId === targetPageId) return
    const targetPage = allPages.find((p) => p.id === targetPageId)
    if (!targetPage || targetPage.type !== 'hub') return
    const draggedPage = allPages.find((p) => p.id === dragId)
    if (!draggedPage || draggedPage.type === 'hub' || !!draggedPage.role) return
    const newType = targetPage.role ? ROLE_TO_PAGE_TYPE[targetPage.role] ?? draggedPage.type : draggedPage.type
    try {
      await updatePage(dragId, { parentId: targetPageId, type: newType as PageType })
      showToast(`Moved "${draggedPage.name}" into "${targetPage.name}"`)
    } catch {
      showToast('Failed to move page')
    }
    setDraggedId(null); setDropTargetId(null)
  }

  function handleRootDragOver(e: React.DragEvent) { if (draggedId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }

  async function handleRootDrop(e: React.DragEvent) {
    e.preventDefault()
    const dragId = Number(e.dataTransfer.getData('text/plain'))
    if (!dragId) return
    const draggedPage = allPages.find((p) => p.id === dragId)
    if (!draggedPage || !draggedPage.parentId) return
    await updatePage(dragId, { parentId: undefined, type: 'general' })
    showToast(`Moved "${draggedPage.name}" to Home`)
    setDraggedId(null); setDropTargetId(null)
  }

  const dragHandleSvg = <DragHandleIcon />

  return (
    <div className={layout.page}>
      <div className={layout.content}>
        <div ref={sentinelRef} />
        <div className={isScrolled ? layout.stickyHeaderScrolled : layout.stickyHeader}>
          <BreadcrumbNav items={[{ label: 'Home', path: '/' }]} moreMenuItems={moreMenuItems} />
          <PageHeader name="Home" onUpdateName={() => {}} readOnly />
        </div>

        <div ref={tableRef} className={table.table} onDragOver={handleRootDragOver} onDrop={handleRootDrop}>
          <div className={table.tableHeader}>
            <button className={table.thName} onClick={() => toggleSort('name')}>Name <span className={table.sortArrow}>{arrow('name')}</span></button>
            <span className={table.thType}>Type</span>
            <button className={table.thDate} onClick={() => toggleSort('createdAt')}>Created on <span className={table.sortArrow}>{arrow('createdAt')}</span></button>
            <button className={table.thDate} onClick={() => toggleSort('updatedAt')}>Last updated <span className={table.sortArrow}>{arrow('updatedAt')}</span></button>
          </div>

          {flatRows.map(({ page, depth }) => {
            const cantDrag = page.type === 'hub' || !!page.role
            const isHub = page.type === 'hub'
            const isDragging = draggedId === page.id
            const isOver = dropTargetId === page.id
            let cls = table.row
            if (isDragging) cls += ' ' + table.rowDragging
            if (isOver && isHub) cls += ' ' + table.rowDropTargetActive
            if (page.archived) cls += ' ' + table.rowArchived

            return (
              <div key={page.id} className={cls} style={{ '--depth': depth } as React.CSSProperties}
                tabIndex={0}
                role="link"
                draggable={!cantDrag}
                onDragStart={(e) => { if (cantDrag) { e.preventDefault(); return }; handleDragStart(e, page.id!) }}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, page.id!)}
                onDragLeave={(e) => handleDragLeave(e, page.id!)}
                onDrop={(e) => handleDrop(e, page.id!)}
                onClick={() => navigate(getPagePath(page, allPages))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(getPagePath(page, allPages)) } }}
              >
                <div className={table.nameCell}>
                  {!cantDrag && <div className={table.dragHandle}>{dragHandleSvg}</div>}
                  <span className={table.rowName}>{page.name}</span>
                </div>
                <span className={table.typeCell}>{page.type === 'hub' ? 'Hub' : 'Page'}</span>
                <span className={table.dateCell}>{formatTableDate(page.createdAt)}</span>
                <span className={table.dateCell}>{formatTableDate(page.updatedAt)}</span>
              </div>
            )
          })}
          {flatRows.length === 0 && <EmptyState message="Create a page to start tracking" />}
        </div>
      </div>
      <OnboardingGuide guideId="home-intro" anchorRef={tableRef} position="right-top" />
    </div>
  )
}
