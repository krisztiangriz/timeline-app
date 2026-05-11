import { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { TimelineView } from '../TimelineView/TimelineView'
import { FeedbackList } from '../PageDetail/FeedbackList'
import { EmptyState } from '../EmptyState/EmptyState'
import { useBlocks, useBlockActions } from '../../hooks/useBlocks'
import { useChildPages, getPagePath } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { usePreferences } from '../../hooks/useAppContext'
import { useTableSort } from '../../hooks/useTableSort'
import { formatTableDate } from '../../utils/dateUtils'
import { db } from '../../db/database'
import type { Page, Block } from '../../types'
import styles from './BlockRenderer.module.css'
import tableStyles from '../../styles/table.module.css'

const ConfigurableViz = lazy(() =>
  import('../Charts/ConfigurableViz').then((m) => ({ default: m.ConfigurableViz }))
)

interface BlockRendererProps {
  page: Page
  /** If provided, only render blocks for this tab. If null, render page-level blocks. */
  activeTabId?: number | null
}

export function BlockRenderer({ page, activeTabId }: BlockRendererProps) {
  const pageId = page.id!
  // If activeTabId is provided (including null for page-level), use it. Otherwise default to null (page-level).
  const tabFilter = activeTabId === undefined ? null : activeTabId
  const blocks = useBlocks(pageId, tabFilter)

  return <BlockList pageId={pageId} page={page} blocks={blocks} tabId={tabFilter ?? undefined} />
}

// ---- Block list ----

function BlockList({ pageId, page, blocks, tabId }: {
  pageId: number; page: Page; blocks: Block[]; tabId?: number
}) {
  const { updateBlock, insertBlockAfter } = useBlockActions()
  const navigate = useNavigate()
  const { allPages } = useAutocomplete()
  const allPagesRef = useRef(allPages)
  allPagesRef.current = allPages

  const handleMentionClick = useCallback((mentionPageId: number) => {
    const p = allPagesRef.current.find((pg) => pg.id === mentionPageId)
    if (p) {
      navigate(getPagePath(p, allPagesRef.current))
    } else {
      navigate(`/page/${mentionPageId}`)
    }
  }, [navigate])

  const handleInsertComponent = useCallback(async (afterBlockId: number, type: 'timeline' | 'feedback' | 'table' | 'visualization') => {
    await insertBlockAfter(afterBlockId, pageId, type, tabId)
    const newBlock = await db.blocks.where('pageId').equals(pageId).filter((b) => tabId ? b.tabId === tabId : !b.tabId).sortBy('order').then((arr) => arr[arr.length - 1])
    if (newBlock) await insertBlockAfter(newBlock.id!, pageId, 'text', tabId, '')
  }, [pageId, tabId, insertBlockAfter])

  // Determine if page has any real content (for placeholder suppression)
  const hasContent = blocks.some((b) => b.type !== 'text' || (b.content?.trim() ?? '').length > 0)
  const defaultPlaceholder = 'Type here... (use ~ to insert components)'

  return (
    <div className={styles.blockList}>
      {blocks.map((block) => {
        const blockClass = block.type !== 'text' ? styles.componentBlock : undefined

        if (block.type === 'text') {
          return (
            <div key={block.id} className={blockClass}>
              <TextBlock block={block} onUpdate={(content) => updateBlock(block.id!, { content })} onInsertComponent={(type) => handleInsertComponent(block.id!, type)}
                onMentionClick={handleMentionClick} placeholder={hasContent ? '' : defaultPlaceholder} />
    </div>
  )
}

        return (
          <div key={block.id} className={blockClass}>
            <ComponentBlockContent block={block} page={page} />
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
  const autoSave = useCallback((h: string) => { if (h !== (block.content ?? '')) onUpdate(h) }, [block.content, onUpdate])

  return (
    <RichTextEditor value={html} onChange={setHtml} onBlur={save} onAutoSave={autoSave} placeholder={placeholder ?? ''} onInsertComponent={onInsertComponent} onMentionClick={onMentionClick} />
  )
}

// ---- Component block content ----

function ComponentBlockContent({ block, page }: { block: Block; page: Page }) {
  switch (block.type) {
    case 'timeline': return <TimelineView pageId={page.id!} page={page} />
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
      {filtered.length === 0 && <EmptyState message="Add pages to this hub" />}
    </div>
  )
}
