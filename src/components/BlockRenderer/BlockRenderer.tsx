import { useState, useEffect, lazy, Suspense, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { TimelineView } from '../TimelineView/TimelineView'
import { FeedbackList } from '../PageDetail/FeedbackList'
import { EmptyState } from '../EmptyState/EmptyState'
import { useBlocks, useBlockActions, getRequiredBlockTypesSync } from '../../hooks/useBlocks'
import { useChildPages, getPagePath, usePageTabs } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { usePreferences } from '../../hooks/useAppContext'
import { useTableSort } from '../../hooks/useTableSort'
import { formatTableDate } from '../../utils/dateUtils'
import { DragHandleIcon, CloseIcon } from '../Icons/Icons'
import { db } from '../../db/database'
import type { Page, Block } from '../../types'
import styles from './BlockRenderer.module.css'
import tableStyles from '../../styles/table.module.css'

const ConfigurableViz = lazy(() =>
  import('../Charts/ConfigurableViz').then((m) => ({ default: m.ConfigurableViz }))
)

interface BlockRendererProps {
  page: Page
  rearrangeMode?: boolean
  /** If provided, only render blocks for this tab. If null, render page-level blocks. */
  activeTabId?: number | null
}

export function BlockRenderer({ page, rearrangeMode = false, activeTabId }: BlockRendererProps) {
  const pageId = page.id!
  // If activeTabId is provided (including null for page-level), use it. Otherwise default to null (page-level).
  const tabFilter = activeTabId === undefined ? null : activeTabId
  const blocks = useBlocks(pageId, tabFilter)

  return <BlockList pageId={pageId} page={page} blocks={blocks} rearrangeMode={rearrangeMode} tabId={tabFilter ?? undefined} />
}

// ---- Block list ----

function BlockList({ pageId, page, blocks, rearrangeMode, tabId }: {
  pageId: number; page: Page; blocks: Block[]; rearrangeMode: boolean; tabId?: number
}) {
  const { updateBlock, deleteBlock, insertBlockAfter } = useBlockActions()
  const navigate = useNavigate()
  const { allPages } = useAutocomplete()

  // Compute required block types for this page
  const requiredTypes = useMemo(() => getRequiredBlockTypesSync(page, allPages), [page, allPages])

  // Determine if the current tab is the first (overview) tab
  const pageTabs = usePageTabs(pageId)
  const isFirstTab = !tabId || (pageTabs.length > 0 && pageTabs[0].id === tabId)

  const handleMentionClick = useCallback((mentionPageId: number) => {
    const p = allPages.find((pg) => pg.id === mentionPageId)
    if (p) {
      navigate(getPagePath(p, allPages))
    } else {
      navigate(`/page/${mentionPageId}`)
    }
  }, [allPages, navigate])

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  function handleDragStart(e: React.DragEvent, idx: number) {
    setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx))
  }
  function handleDragOver(e: React.DragEvent, idx: number) {
    if (dragIdx === null || dragIdx === idx) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropIdx(idx)
  }
  async function handleDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === targetIdx) return
    const newBlocks = [...blocks]
    const [moved] = newBlocks.splice(dragIdx, 1)
    newBlocks.splice(targetIdx, 0, moved)
    await db.transaction('rw', db.blocks, async () => {
      for (let i = 0; i < newBlocks.length; i++) await db.blocks.update(newBlocks[i].id!, { order: i })
    })
    setDragIdx(null); setDropIdx(null)
  }
  function handleDragEnd() { setDragIdx(null); setDropIdx(null) }

  const handleInsertComponent = useCallback(async (afterBlockId: number, type: 'timeline' | 'feedback' | 'table' | 'visualization') => {
    await insertBlockAfter(afterBlockId, pageId, type, tabId)
    const newBlock = await db.blocks.where('pageId').equals(pageId).filter((b) => tabId ? b.tabId === tabId : !b.tabId).sortBy('order').then((arr) => arr[arr.length - 1])
    if (newBlock) await insertBlockAfter(newBlock.id!, pageId, 'text', tabId, '')
  }, [pageId, tabId, insertBlockAfter])

  // Determine if page has any real content (for placeholder suppression)
  const hasContent = blocks.some((b) => b.type !== 'text' || (b.content?.trim() ?? '').length > 0)
  const defaultPlaceholder = 'Type here... (use ~ to insert components)'

  const dragHandle = (
    <div className={styles.dragHandleVisible}>
      <DragHandleIcon />
    </div>
  )

  return (
    <div className={styles.blockList}>
      {blocks.map((block, idx) => {
        const isDragging = dragIdx === idx
        const isDropTarget = dropIdx === idx
        const blockClasses = [
          block.type !== 'text' ? styles.componentBlock : '',
          rearrangeMode ? styles.blockEditable : '',
          isDragging ? styles.blockDragging : '',
          isDropTarget ? styles.blockDropTarget : '',
        ].filter(Boolean).join(' ')

        const dragProps = rearrangeMode ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => handleDragStart(e, idx),
          onDragEnd: handleDragEnd,
          onDragOver: (e: React.DragEvent) => handleDragOver(e, idx),
          onDrop: (e: React.DragEvent) => handleDrop(e, idx),
        } : {}

        if (block.type === 'text') {
          return (
            <div key={block.id} className={blockClasses || undefined} {...dragProps}>
              {rearrangeMode && dragHandle}
              <TextBlock block={block} onUpdate={(content) => updateBlock(block.id!, { content })} onInsertComponent={(type) => handleInsertComponent(block.id!, type)}
                onMentionClick={handleMentionClick} placeholder={hasContent ? '' : defaultPlaceholder} />
            </div>
          )
        }

        const isProtected = rearrangeMode && isFirstTab && requiredTypes.has(block.type) &&
          blocks.filter((b) => b.type === block.type).length <= 1

        return (
          <div key={block.id} className={blockClasses || undefined} {...dragProps}>
            {rearrangeMode && dragHandle}
            {rearrangeMode && !isProtected && (
              <button className={styles.deleteBtnVisible} onClick={() => deleteBlock(block.id!)} aria-label="Delete block">
                <CloseIcon size={10} />
              </button>
            )}
            <ComponentBlockContent block={block} page={page} allPages={allPages} />
          </div>
        )
      })}

      {blocks.length === 0 && (
        <TextBlock
          block={{ pageId, tabId, type: 'text', content: '', order: 0 }}
          onUpdate={async (content) => { await db.blocks.add({ pageId, tabId, type: 'text', content, order: 0 }) }}
          onInsertComponent={async (type) => {
            const textId = await db.blocks.add({ pageId, tabId, type: 'text', content: '', order: 0 })
            await insertBlockAfter(textId as number, pageId, type, tabId)
          }}
          onMentionClick={handleMentionClick}
          placeholder={defaultPlaceholder}
        />
      )}
    </div>
  )
}

// ---- Text block ----

function TextBlock({ block, onUpdate, onInsertComponent, onMentionClick, placeholder }: {
  block: Block | { pageId: number; tabId?: number; type: 'text'; content: string; order: number }
  onUpdate: (content: string) => void
  onInsertComponent: (type: 'timeline' | 'feedback' | 'table' | 'visualization') => void
  onMentionClick?: (pageId: number) => void
  placeholder?: string
}) {
  const [html, setHtml] = useState(block.content ?? '')
  useEffect(() => { setHtml(block.content ?? '') }, [block.content])
  function save() { if (html !== (block.content ?? '')) onUpdate(html) }

  return (
    <RichTextEditor value={html} onChange={setHtml} onBlur={save} placeholder={placeholder ?? ''} onInsertComponent={onInsertComponent} onMentionClick={onMentionClick} />
  )
}

// ---- Component block content ----

function ComponentBlockContent({ block, page, allPages }: { block: Block; page: Page; allPages: Page[] }) {
  // Timeline on generic hub children (meetings, admin) is read-only (cross-refs only)
  const parentHub = page.parentId ? allPages.find((p) => p.id === page.parentId) : undefined
  const timelineReadOnly = parentHub?.type === 'hub' && !parentHub.role

  switch (block.type) {
    case 'timeline': return <TimelineView pageId={page.id!} readOnly={timelineReadOnly} />
    case 'feedback': return <FeedbackList subjectId={page.id!} />
    case 'visualization': return <Suspense fallback={null}><ConfigurableViz blockId={block.id!} pageId={page.id!} /></Suspense>
    case 'table': return <TableBlock page={page} />
    default: return null
  }
}

// ---- Table block ----

function TableBlock({ page }: { page: Page }) {
  const children = useChildPages(page.id)
  const { allPages } = useAutocomplete()
  const { showArchived } = usePreferences()
  const navigate = useNavigate()
  const { toggleSort, sortPages, arrow } = useTableSort(`page-${page.id}-table`)
  const filtered = showArchived ? children : children.filter((c) => !c.archived)
  const sorted = sortPages(filtered)

  return (
    <div className={tableStyles.table} style={{ padding: 0 }}>
      <div className={tableStyles.tableHeader}>
        <span className={tableStyles.thName} onClick={() => toggleSort('name')}>Name <span className={tableStyles.sortArrow}>{arrow('name')}</span></span>
        <span className={tableStyles.thDate} onClick={() => toggleSort('createdAt')}>Created on <span className={tableStyles.sortArrow}>{arrow('createdAt')}</span></span>
        <span className={tableStyles.thDate} onClick={() => toggleSort('updatedAt')}>Last updated <span className={tableStyles.sortArrow}>{arrow('updatedAt')}</span></span>
      </div>
      {sorted.map((child) => (
        <div key={child.id} className={child.archived ? `${tableStyles.row} ${tableStyles.rowArchived}` : tableStyles.row} onClick={() => navigate(getPagePath(child, allPages))}>
          <div className={tableStyles.nameCell}><span className={tableStyles.rowName}>{child.name}</span></div>
          <span className={tableStyles.dateCell}>{formatTableDate(child.createdAt)}</span>
          <span className={tableStyles.dateCell}>{formatTableDate(child.updatedAt)}</span>
        </div>
      ))}
      {filtered.length === 0 && <EmptyState message="No pages yet" />}
    </div>
  )
}
