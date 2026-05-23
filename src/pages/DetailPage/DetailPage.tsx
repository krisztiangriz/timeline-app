import { useStickyScroll } from '../../hooks/useStickyScroll'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { BreadcrumbNav } from '../../components/Breadcrumb/Breadcrumb'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { PageForm, type PageFormData } from '../../components/PageForm/PageForm'
import { BlockRenderer } from '../../components/BlockRenderer/BlockRenderer'
import { PropertyRow } from '../../components/PropertyRow/PropertyRow'
import { usePage, usePageActions, usePageTabs, getPagePath, persistBlockEdits } from '../../hooks/usePages'
import { useBlocks, useBlockActions } from '../../hooks/useBlocks'
import { usePageMenus } from '../../hooks/usePageMenus'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useToast } from '../../hooks/useToast'
import { useHubPageProperties, usePagePropertyValues, setPagePropertyValue, getPagePropertyValue } from '../../hooks/useHubProperties'
import layout from '../../styles/layout.module.css'
import pd from '../../components/PageDetail/PageDetail.module.css'

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
  const [editPageOpen, setEditPageOpen] = useState(false)
  const [activeTabId, setActiveTabId] = useState<number | null>(null)
  const allBlocks = useBlocks(pageId)
  const { deleteBlock } = useBlockActions()

  // Hub properties
  const parentHub = page?.parentId ? allPages.find((p) => p.id === page.parentId) : undefined
  const hubProperties = useHubPageProperties(parentHub?.id)
  const propertyValues = usePagePropertyValues(pageId)

  const tabIds = tabs.map(t => t.id).join(',')
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTabId)) setActiveTabId(tabs[0].id!)
    else if (tabs.length === 0) setActiveTabId(null)
  }, [tabIds, activeTabId]) // eslint-disable-line react-hooks/exhaustive-deps

  const hubPath = parentHub ? getPagePath(parentHub, allPages) : '/'
  const pagePath = routePrefix ? `/${routePrefix}/${page?.id}` : `/page/${page?.id}`

  const protectedTabCount = parentHub?.role === 'colleague-hub' || parentHub?.role === 'project-hub'
    ? 3
    : 0

  const canDelete = !page?.role
  const isMainTimeline = page?.role === 'main-timeline'
  const canArchive = !isMainTimeline

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

  const { moreMenuItems } = usePageMenus({
    pageId, canDelete, canArchive, isArchived: !!page?.archived,
    deleteRedirect: hubPath,
    onEditPage: isMainTimeline ? undefined : () => setEditPageOpen(true),
    onArchive: handleArchive,
    deletePage, pageName: page?.name, showToast,
  })

  const editInitial = useMemo(() => {
    const parentHub = page?.parentId ? allPages.find((p) => p.id === page.parentId) : undefined
    return {
      name: page?.name ?? '',
      tabs: tabs.map((l) => {
        const block = allBlocks.find((b) => b.tabId === l.id)
        return { name: l.name, type: block?.type ?? 'text' as const }
      }),
      mentionTrigger: page?.mentionTrigger,
      mentionCollapsed: page?.mentionCollapsed,
      inheritedTrigger: parentHub?.mentionTrigger,
      inheritedFrom: parentHub?.name,
      blocks: allBlocks.filter((b) => b.id).map((b) => ({ id: b.id!, type: b.type, tabId: b.tabId })),
      tabInfo: tabs.map((t) => ({ id: t.id!, name: t.name })),
    }
  }, [page, tabs, allPages, allBlocks])

  async function handleEditSubmit(data: PageFormData) {
    if (!pageId) return
    try {
      await updatePage(pageId, { name: data.name, mentionTrigger: data.mentionTrigger, mentionCollapsed: data.mentionCollapsed })
      await updateTabs(pageId, data.tabs)
      await persistBlockEdits(data.blocks, data.deletedBlockIds, deleteBlock)
      setEditPageOpen(false); showToast('Page updated')
    } catch {
      showToast('Failed to update page')
    }
  }

  if (!page) return null

  return (
    <div className={layout.page}>
      <div className={layout.contentPadded}>
        <div ref={sentinelRef} />
        <div className={isScrolled ? layout.stickyHeaderScrolled : layout.stickyHeader}>
          <BreadcrumbNav items={[{ label: 'Home', path: '/' }, ...(parentHub ? [{ label: parentHub.name, path: hubPath }] : []), { label: page.name, path: pagePath }]} moreMenuItems={moreMenuItems} />
          {hubProperties.length === 1 ? (
            <PageHeader
              name={page.name}
              onUpdateName={(name) => updatePage(pageId!, { name })}
              tabs={tabs}
              activeTabId={activeTabId}
              onTabChange={setActiveTabId}
              actions={
                <PropertyRow
                  property={hubProperties[0]}
                  value={getPagePropertyValue(propertyValues, hubProperties[0].id!)}
                  onChange={(value) => setPagePropertyValue(pageId!, hubProperties[0].id!, value)}
                />
              }
            />
          ) : (
            <>
              <PageHeader name={page.name} onUpdateName={(name) => updatePage(pageId!, { name })} tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
              {hubProperties.length > 1 && (
                <div className={pd.propertyRow}>
                  {hubProperties.map((prop) => (
                    <PropertyRow
                      key={prop.id}
                      property={prop}
                      value={getPagePropertyValue(propertyValues, prop.id!)}
                      onChange={(value) => setPagePropertyValue(pageId!, prop.id!, value)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <BlockRenderer page={page} activeTabId={activeTabId} />
      </div>
      <PageForm open={editPageOpen} onClose={() => setEditPageOpen(false)} onSubmit={handleEditSubmit} initial={editInitial} isEdit isHub={page.type === 'hub' || undefined} hubId={page.type === 'hub' ? page.id : undefined} protectedTabCount={protectedTabCount} />
    </div>
  )
}
