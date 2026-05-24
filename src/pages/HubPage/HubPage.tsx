import { useStickyScroll } from '../../hooks/useStickyScroll'
import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BreadcrumbNav } from '../../components/Breadcrumb/Breadcrumb'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { PageForm, type PageFormData } from '../../components/PageForm/PageForm'
import { ConfirmModal } from '../../components/ConfirmModal/ConfirmModal'
import { BlockRenderer } from '../../components/BlockRenderer/BlockRenderer'
import { usePageByRole, usePageActions, usePageTabs, getPagePath } from '../../hooks/usePages'
import { useBlocks } from '../../hooks/useBlocks'
import { usePageMenus } from '../../hooks/usePageMenus'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useToast } from '../../hooks/useToast'
import type { PageRole } from '../../types'
import layout from '../../styles/layout.module.css'

interface HubPageProps {
  role: PageRole
}

export function HubPage({ role }: HubPageProps) {
  const hub = usePageByRole(role)
  const tabs = usePageTabs(hub?.id)
  const navigate = useNavigate()
  const { updatePage, deletePage, updateTabs, archivePage, unarchivePage } = usePageActions()
  const { allPages } = useAutocomplete()
  const { show: showToast } = useToast()
  const { sentinelRef, isScrolled } = useStickyScroll()
  const [editPageOpen, setEditPageOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const allBlocks = useBlocks(hub?.id)

  const hubPath = hub ? getPagePath(hub, allPages) : '/'

  const handleArchive = useCallback(async () => {
    if (!hub?.id) return
    if (hub.archived) {
      await unarchivePage(hub.id)
      showToast('Unarchived')
    } else {
      await archivePage(hub.id)
      showToast('Archived')
    }
  }, [hub, archivePage, unarchivePage, showToast])

  const { moreMenuItems } = usePageMenus({
    pageId: hub?.id,
    onEditPage: () => setEditPageOpen(true),
    canDelete: true, canArchive: true, isArchived: !!hub?.archived,
    deleteRedirect: '/',
    onArchive: handleArchive,
    onRequestDelete: () => setDeleteConfirm(true),
    deletePage, pageName: hub?.name, showToast,
  })

  const editInitial = useMemo(() => ({
    name: hub?.name ?? '',
    tabs: tabs.map((t) => {
      const block = allBlocks.find((b) => b.tabId === t.id)
      return { id: t.id!, name: t.name, type: block?.type ?? 'text' as const }
    }),
    mentionTrigger: hub?.mentionTrigger,
    mentionCollapsed: hub?.mentionCollapsed,
  }), [hub, tabs, allBlocks])

  async function handleEditSubmit(data: PageFormData) {
    if (!hub?.id) return
    try {
      await updatePage(hub.id, { name: data.name, mentionTrigger: data.mentionTrigger, mentionCollapsed: data.mentionCollapsed })
      await updateTabs(hub.id, data.tabs)
      setEditPageOpen(false); showToast('Page updated')
    } catch {
      showToast('Failed to update page')
    }
  }

  if (!hub) return null

  return (
    <div className={layout.page}>
      <div className={layout.content}>
        <div ref={sentinelRef} />
        <div className={isScrolled ? layout.stickyHeaderScrolled : layout.stickyHeader}>
          <BreadcrumbNav items={[{ label: 'Home', path: '/' }, { label: hub.name, path: hubPath }]} moreMenuItems={moreMenuItems} />
          <PageHeader name={hub.name} onUpdateName={(name) => updatePage(hub.id!, { name })} />
        </div>
        <BlockRenderer page={hub} />
      </div>
      <PageForm open={editPageOpen} onClose={() => setEditPageOpen(false)} onSubmit={handleEditSubmit} initial={editInitial} isEdit isHub hubId={hub.id!} />
      <ConfirmModal
        open={deleteConfirm}
        title="Delete hub"
        message={`Are you sure you want to delete "${hub.name}"? This will also delete all child pages.`}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={async () => { await deletePage(hub.id!); navigate('/'); setDeleteConfirm(false) }}
      />
    </div>
  )
}
