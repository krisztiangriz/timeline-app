import { useState, useMemo, memo } from 'react'
import type { TimelineEntry } from '../../types'
import { stripHtml } from '../../utils/stripHtml'
import { filterHtmlToMention, stripSelfMention } from '../../utils/mentionParser'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { RichTextDisplay } from '../RichTextEditor/RichTextDisplay'
import { TrashIcon } from '../Icons/Icons'
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
  }

  if (editing) {
    return (
      <div className={styles.entryRow}>
        <div className={styles.entryRowText}>
          <RichTextEditor
            value={editHtml}
            onChange={setEditHtml}
            onBlur={handleSave}
            autoFocus
          />
        </div>
      </div>
    )
  }

  const hasHtml = !isPlainText(displayText)

  return (
    <div className={styles.entryRow}>
      <div
        className={crossRefPageId ? styles.entryRowTextDisabled : styles.entryRowText}
        onClick={crossRefPageId ? undefined : () => {
          setEditHtml(entry.text)
          setEditing(true)
        }}
        style={{ cursor: crossRefPageId ? 'default' : 'text' }}
      >
        {hasHtml ? (
          <RichTextDisplay html={displayText} />
        ) : (
          <span className={styles.entryText}>{displayText}</span>
        )}
      </div>
      {!crossRefPageId && (
        <button
          className={styles.entryDeleteButton}
          onClick={() => onDelete(entry.id!)}
          aria-label="Delete entry"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  )
})
