import { useState, useRef, useCallback, memo } from 'react'
import type { TimelineEntry } from '../../types'
import { stripHtml } from '../../utils/stripHtml'
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
  /** If true, entry is a cross-reference (read-only, muted style) */
  crossRef?: boolean
  /** Controlled editing state from parent */
  editing?: boolean
  /** Called when the user wants to start editing (click or Enter) */
  onStartEditing?: (clickPos?: { x: number; y: number }) => void
  /** Called when user presses Escape to exit editing */
  onEscape?: () => void
  /** Called when user clicks a mention link */
  onMentionClick?: (pageId: number) => void
}

export const TimelineEntryRow = memo(function TimelineEntryRow({
  entry,
  onUpdate,
  onDelete,
  crossRef,
  editing: controlledEditing,
  onStartEditing,
  onEscape,
  onMentionClick,
}: TimelineEntryRowProps) {
  // Support both controlled (parent manages editing) and uncontrolled (self-managed) modes
  const [internalEditing, setInternalEditing] = useState(false)
  const editing = controlledEditing !== undefined ? controlledEditing : internalEditing
  const [editHtml, setEditHtml] = useState(entry.text)
  const clickPos = useRef<{ x: number; y: number } | undefined>(undefined)

  function handleSave() {
    const plain = stripHtml(editHtml).trim()
    if (!plain) {
      onDelete(entry.id!)
    } else if (editHtml !== entry.text) {
      onUpdate(entry.id!, { text: editHtml })
    }
    if (controlledEditing === undefined) {
      setInternalEditing(false)
    }
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

    const pos = { x: e.clientX, y: e.clientY }
    clickPos.current = pos
    setEditHtml(entry.text)
    if (onStartEditing) {
      onStartEditing(pos)
    } else {
      setInternalEditing(true)
    }
  }

  function handleKeyboardActivate(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      clickPos.current = undefined
      setEditHtml(entry.text)
      if (onStartEditing) {
        onStartEditing()
      } else {
        setInternalEditing(true)
      }
    }
  }

  function handleEscape() {
    if (onEscape) {
      onEscape()
    } else {
      setInternalEditing(false)
    }
  }

  const hasHtml = !isPlainText(entry.text)

  return (
    <div
      data-entry-row
      className={crossRef ? styles.entryRowTextDisabled : styles.entryRowText}
      style={{ position: 'relative', cursor: editing || crossRef ? 'auto' : 'text' }}
    >
      {!editing && !crossRef && (
        <button
          className={styles.entryEditOverlay}
          onClick={handleStartEditing}
          onKeyDown={handleKeyboardActivate}
          aria-label="Edit entry"
          tabIndex={0}
        />
      )}
      {editing ? (
        <RichTextEditor
          value={editHtml}
          onChange={setEditHtml}
          onBlur={handleSave}
          onAutoSave={handleAutoSave}
          onEscape={handleEscape}
          onMentionClick={onMentionClick}
          autoFocus
          initialClickPosition={clickPos.current}
          collapseMentions
        />
      ) : hasHtml ? (
        <RichTextDisplay html={entry.text} collapseMentions />
      ) : (
        <span className={styles.entryText}>{entry.text}</span>
      )}
    </div>
  )
})
