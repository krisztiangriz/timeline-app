import { useStickyScroll } from '../../hooks/useStickyScroll'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BreadcrumbNav } from '../../components/Breadcrumb/Breadcrumb'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { usePreferences } from '../../hooks/useAppContext'
import {
  usePageActions,
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
import layout from '../../styles/layout.module.css'
import table from '../../styles/table.module.css'

/** Check if a page is a hub (accepts drops) */
function isHubPage(type: string): boolean {
  return type === 'hub'
}

export function RootPage() {
  const { allPages } = useAutocomplete()
  const { updatePage } = usePageActions()
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

  const { moreMenuItems } = usePageMenus({ showToast })

  function handleDragStart(e: React.DragEvent, pageId: number) {
    setDraggedId(pageId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(pageId))
  }

  function handleDragEnd() { setDraggedId(null); setDropTargetId(null) }

  function handleDragOver(e: React.DragEvent, targetPageId: number) {
    const targetPage = allPages.find((p) => p.id === targetPageId)
    if (!targetPage || !isHubPage(targetPage.type) || targetPageId === draggedId) return
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
    if (!targetPage || !isHubPage(targetPage.type)) return
    const draggedPage = allPages.find((p) => p.id === dragId)
    if (!draggedPage || isHubPage(draggedPage.type) || !!draggedPage.role) return
    const newType = targetPage.role ? ROLE_TO_PAGE_TYPE[targetPage.role] ?? draggedPage.type : draggedPage.type
    await updatePage(dragId, { parentId: targetPageId, type: newType as PageType })
    showToast(`Moved "${draggedPage.name}" into "${targetPage.name}"`)
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

        <div className={table.table} onDragOver={handleRootDragOver} onDrop={handleRootDrop}>
          <div className={table.tableHeader}>
            <span className={table.thName} onClick={() => toggleSort('name')}>Name <span className={table.sortArrow}>{arrow('name')}</span></span>
            <span className={table.thType}>Type</span>
            <span className={table.thDate} onClick={() => toggleSort('createdAt')}>Created on <span className={table.sortArrow}>{arrow('createdAt')}</span></span>
            <span className={table.thDate} onClick={() => toggleSort('updatedAt')}>Last updated <span className={table.sortArrow}>{arrow('updatedAt')}</span></span>
          </div>

          {flatRows.map(({ page, depth }) => {
            const cantDrag = isHubPage(page.type) || !!page.role
            const isHub = isHubPage(page.type)
            const isDragging = draggedId === page.id
            const isOver = dropTargetId === page.id
            let cls = table.row
            if (isDragging) cls += ' ' + table.rowDragging
            if (isOver && isHub) cls += ' ' + table.rowDropTargetActive
            if (page.archived) cls += ' ' + table.rowArchived

            return (
              <div key={page.id} className={cls} style={{ paddingLeft: depth * 16 }}
                draggable={!cantDrag}
                onDragStart={(e) => { if (cantDrag) { e.preventDefault(); return }; handleDragStart(e, page.id!) }}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, page.id!)}
                onDragLeave={(e) => handleDragLeave(e, page.id!)}
                onDrop={(e) => handleDrop(e, page.id!)}
                onClick={() => navigate(getPagePath(page, allPages))}
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
    </div>
  )
}
