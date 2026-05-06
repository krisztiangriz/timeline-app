import { useState, useMemo, useRef, useCallback, memo } from 'react'
import type { TimelineEntry } from '../../types'
import { stripHtml } from '../../utils/stripHtml'
import { filterHtmlToMention, stripSelfMention } from '../../utils/mentionParser'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { RichTextDisplay } from '../RichTextEditor/RichTextDisplay'
import styles from './TimelineView.module.css'

function isPlainText(text: string): boolean {
  return !/<[a-z][\s\S]*>/i.test(text)
}

interface TimelineEntryRowProps {
  entry: TimelineEntry
  onUpdate: (id: number, data: { text?: string }) => void
  onDelete: (id: number) => void
  /** If set, only show lines that reference this page ID (cross-ref mode) */
  crossRefPageId?: number
}

export const TimelineEntryRow = memo(function TimelineEntryRow({
  entry,
  onUpdate,
  onDelete,
  crossRefPageId,
}: TimelineEntryRowProps) {
  const [editing, setEditing] = useState(false)
  const [editHtml, setEditHtml] = useState(entry.text)
  const clickPos = useRef<{ x: number; y: number } | undefined>(undefined)

  // For cross-ref entries, filter to only relevant lines and strip self-mention
  const displayText = useMemo(() => {
    if (!crossRefPageId) return entry.text
    const filtered = filterHtmlToMention(entry.text, crossRefPageId)
    return stripSelfMention(filtered, crossRefPageId)
  }, [entry.text, crossRefPageId])

  // Hide cross-ref entries that are empty after stripping the self-mention
  if (crossRefPageId && !displayText) return null

  function handleSave() {
    const plain = stripHtml(editHtml).trim()
    if (!plain) {
      onDelete(entry.id!)
    } else if (editHtml !== entry.text) {
      onUpdate(entry.id!, { text: editHtml })
    }
    setEditing(false)
    clickPos.current = undefined
  }

  // Auto-save: persist without exiting edit mode
  const handleAutoSave = useCallback((html: string) => {
    const plain = stripHtml(html).trim()
    if (plain && html !== entry.text) {
      onUpdate(entry.id!, { text: html })
    }
  }, [entry.id, entry.text, onUpdate])

  function handleStartEditing(e: React.MouseEvent) {
    // Don't enter edit mode if clicking on a mention link
    const target = e.target as HTMLElement
    if (target.closest('[data-page-id]')) return

    clickPos.current = { x: e.clientX, y: e.clientY }
    setEditHtml(entry.text)
    setEditing(true)
  }

  const hasHtml = !isPlainText(displayText)

  return (
    <div
      className={crossRefPageId ? styles.entryRowTextDisabled : styles.entryRowText}
      onClick={!editing && !crossRefPageId ? handleStartEditing : undefined}
        style={{ cursor: editing || crossRefPageId ? 'auto' : 'text' }}
    >
      {editing ? (
        <RichTextEditor
          value={editHtml}
          onChange={setEditHtml}
          onBlur={handleSave}
          onAutoSave={handleAutoSave}
          autoFocus
          initialClickPosition={clickPos.current}
          collapseMentions
        />
      ) : hasHtml ? (
        <RichTextDisplay html={displayText} collapseMentions />
      ) : (
        <span className={styles.entryText}>{displayText}</span>
      )}
    </div>
  )
})
