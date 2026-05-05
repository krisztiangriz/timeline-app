import { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { stripHtml } from '../../utils/stripHtml'
import { filterHtmlToMentionLines } from '../../utils/mentionParser'

import { useTimelineEntries, useCrossRefEntries, useTimelineActions } from '../../hooks/useTimeline'
import { getPagePath } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { formatEntryDate, startOfDay } from '../../utils/dateUtils'
import { TimelineEntryRow } from './TimelineEntryRow'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { RichTextDisplay } from '../RichTextEditor/RichTextDisplay'
import type { TimelineEntry } from '../../types'
import styles from './TimelineView.module.css'

const NOOP = () => {}

/** Strip data-checkbox spans from HTML, keeping inner text and all other formatting */
function stripCheckboxHtml(html: string): string {
  return html.replace(/<span data-checkbox="[^"]*">([\s\S]*?)<\/span>/g, '$1').trim()
}

/** Convert HTML text to sentence case, preserving mention span content */
function toSentenceCase(html: string): string {
  let first = true
  let mentionDepth = 0
  return html.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) {
      if (/data-page-id/.test(tag)) mentionDepth++
      else if (tag === '</span>' && mentionDepth > 0) mentionDepth--
      return tag
    }
    if (mentionDepth > 0) return text
    let result = text.toLowerCase()
    if (first) {
      result = result.replace(/[a-z]/, (c: string) => c.toUpperCase())
      first = false
    }
    return result
  })
}

// ---- Pending item row (component renders the checkbox, DB has plain text) ----

const PendingItemRow = memo(function PendingItemRow({ entry, onComplete, onUpdate, onDelete }: {
  entry: TimelineEntry
  onComplete: (id: number) => void
  onUpdate: (id: number, data: { text?: string }) => void
  onDelete: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editHtml, setEditHtml] = useState(entry.text)
  const clickPos = useRef<{ x: number; y: number } | undefined>(undefined)

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

  function handleStartEditing(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('[data-page-id]')) return
    clickPos.current = { x: e.clientX, y: e.clientY }
    setEditHtml(entry.text)
    setEditing(true)
  }

  const hasHtml = /<[a-z][\s\S]*>/i.test(entry.text)

  return (
    <div className={styles.pendingInputRow}>
      <span
        className={styles.checkboxInteractive}
        onClick={() => onComplete(entry.id!)}
      />
      <div style={{ flex: 1 }}>
        {editing ? (
          <RichTextEditor
            value={editHtml}
            onChange={setEditHtml}
            onBlur={handleSave}
            autoFocus
            initialClickPosition={clickPos.current}
          />
        ) : (
          <div
            onClick={handleStartEditing}
            style={{ cursor: 'text' }}
          >
            {hasHtml ? (
              <RichTextDisplay html={entry.text} />
            ) : (
              <span className={styles.entryText}>{entry.text}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

// ---- Timeline view ----

interface TimelineViewProps {
  pageId: number
  title?: string
  /** If true, only show cross-ref entries — hide pending section and today editor */
  readOnly?: boolean
}

export function TimelineView({ pageId, title, readOnly = false }: TimelineViewProps) {
  const directEntries = useTimelineEntries(pageId)
  const crossRefEntries = useCrossRefEntries(pageId)
  const { addEntry, updateEntry, deleteEntry } = useTimelineActions()
  const { allPages } = useAutocomplete()
  const navigate = useNavigate()

  const directIds = useMemo(() => new Set(directEntries.map((e) => e.id!)), [directEntries])

  const allEntries = useMemo(() => {
    const seen = new Set<number>()
    const merged: TimelineEntry[] = []
    for (const e of directEntries) {
      if (e.id && !seen.has(e.id)) { seen.add(e.id); merged.push(e) }
    }
    for (const e of crossRefEntries) {
      if (e.id && !seen.has(e.id)) { seen.add(e.id); merged.push(e) }
    }
    return merged
  }, [directEntries, crossRefEntries])

  const [pendingInput, setPendingInput] = useState('')

  // Split entries into pending, today (direct + cross-ref), and history groups
  const { pendingEntries, todayEntry, todayCrossRefs, historyGroups } = useMemo(() => {
    const pending: TimelineEntry[] = []
    const dated = new Map<string, TimelineEntry[]>()

    for (const entry of allEntries) {
      if (entry.isPending) {
        pending.push(entry)
      } else {
        const key = startOfDay(new Date(entry.date)).toISOString()
        const group = dated.get(key) ?? []
        group.push(entry)
        dated.set(key, group)
      }
    }

    const sortedGroups = [...dated.entries()].sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    )

    const todayKey = startOfDay(new Date()).toISOString()
    const todayAll = dated.get(todayKey) ?? []
    // Direct today entry = the one owned by this page
    const todayDirect = todayAll.find((e) => directIds.has(e.id!))
    // Cross-ref today entries = from other pages that mention this page
    const todayCrossRefEntries = todayAll.filter((e) => !directIds.has(e.id!))
    const history = sortedGroups.filter(([key]) => key !== todayKey)

    // Sort pending items oldest-first so new items appear at the bottom
    pending.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return { pendingEntries: pending, todayEntry: todayDirect, todayCrossRefs: todayCrossRefEntries, historyGroups: history }
  }, [allEntries, directIds])

  // Today's content as a single editable block
  const [todayHtml, setTodayHtml] = useState('')
  const todayEntryId = useRef<number | undefined>(undefined)
  const todayFocusedRef = useRef(false)

  // Sync today entry from DB → local state (only when editor is not focused)
  useEffect(() => {
    if (todayEntry) {
      todayEntryId.current = todayEntry.id
      if (!todayFocusedRef.current) {
        setTodayHtml(todayEntry.text)
      }
    } else {
      todayEntryId.current = undefined
      if (!todayFocusedRef.current) {
        setTodayHtml('')
      }
    }
  }, [todayEntry])

  // ---- Handlers ----

  async function handleAddPending() {
    const plain = stripHtml(pendingInput).trim()
    if (!plain) {
      // Empty Enter — close input, revert to placeholder
      setPendingInput('')
      return
    }
    // Strip any checkbox HTML that might have been typed via []
    const cleanText = stripCheckboxHtml(pendingInput)
    if (cleanText) {
      await addEntry({ pageId, text: cleanText, isPending: true })
    }
    setPendingInput('')
  }

  async function handleTodaySave() {
    todayFocusedRef.current = false
    const plain = stripHtml(todayHtml).trim()

    if (todayEntryId.current) {
      if (!plain) {
        await deleteEntry(todayEntryId.current)
        todayEntryId.current = undefined
      } else if (todayHtml !== (todayEntry?.text ?? '')) {
        await updateEntry(todayEntryId.current, { text: todayHtml })
      }
    } else if (plain) {
      const id = await addEntry({ pageId, text: todayHtml, isPending: false })
      todayEntryId.current = id
    }
  }

  async function handleCompletePending(id: number) {
    const entry = allEntries.find((e) => e.id === id)
    if (!entry) return
    const cleanText = toSentenceCase(stripCheckboxHtml(entry.text.trim()))
    if (cleanText) {
      // Append to today's content (use local state which may have unsaved edits)
      if (todayEntryId.current) {
        const currentText = todayHtml
        const newText = currentText
          ? currentText + '<div>' + cleanText + '</div>'
          : cleanText
        await updateEntry(todayEntryId.current, { text: newText })
        setTodayHtml(newText)
      } else {
        const newId = await addEntry({ pageId, text: cleanText, isPending: false })
        todayEntryId.current = newId
        setTodayHtml(cleanText)
      }
    }
    await deleteEntry(id)
  }

  const handleUpdateEntry = useCallback(async (id: number, data: { text?: string }) => {
    await updateEntry(id, data)
  }, [updateEntry])

  const handleDeleteEntry = useCallback(async (id: number) => {
    await deleteEntry(id)
  }, [deleteEntry])

  const allPagesRef = useRef(allPages)
  allPagesRef.current = allPages

  const handleMentionClick = useCallback((mentionPageId: number) => {
    const page = allPagesRef.current.find((p) => p.id === mentionPageId)
    if (page) {
      navigate(getPagePath(page, allPagesRef.current))
    } else {
      navigate(`/page/${mentionPageId}`)
    }
  }, [navigate])

  return (
    <div className={styles.timeline}>
      {title && <span className={styles.sectionTitle}>{title}</span>}

      {/* Pending section — only in write mode */}
      {!readOnly && (
        <div className={styles.section}>
          <div className={styles.sectionContent}>
            {pendingEntries.map((entry) => (
              <PendingItemRow
                key={entry.id}
                entry={entry}
                onComplete={handleCompletePending}
                onUpdate={handleUpdateEntry}
                onDelete={handleDeleteEntry}
              />
            ))}
            <div className={styles.pendingInputRow}>
              <span className={styles.checkboxDecor} />
              <div style={{ flex: 1 }}>
                <RichTextEditor
                  value={pendingInput}
                  onChange={setPendingInput}
                  onEnter={handleAddPending}
                  onBlur={() => setPendingInput('')}
                  placeholder="Add a task…"
                />
              </div>
            </div>
          </div>
          <span className={styles.sectionDate}>Pending</span>
        </div>
      )}

      {/* Today section — editor only in write mode, cross-refs always */}
      <div className={styles.section}>
        <div className={styles.sectionContent}>
          {!readOnly && (
            <div onFocus={() => { todayFocusedRef.current = true }}>
              <RichTextEditor
                value={todayHtml}
                onChange={setTodayHtml}
                onBlur={handleTodaySave}
                onMentionClick={handleMentionClick}
                placeholder="Type here…"
              />
            </div>
          )}
          {todayCrossRefs.flatMap((entry) => {
            const lines = filterHtmlToMentionLines(entry.text, pageId)
            return lines.map((lineHtml, li) => (
              <TimelineEntryRow
                key={`${entry.id}-${li}`}
                entry={{ ...entry, text: lineHtml }}
                onUpdate={NOOP}
                onDelete={NOOP}
                crossRefPageId={pageId}
              />
            ))
          })}
        </div>
        <span className={styles.sectionDate}>Today</span>
      </div>

      {/* History sections */}
      {historyGroups.map(([dateKey, entries]) => (
        <div key={dateKey} className={styles.section}>
          <div className={styles.sectionContent}>
            {entries.flatMap((entry) => {
              const isCrossRef = !directIds.has(entry.id!)
              if (isCrossRef) {
                const lines = filterHtmlToMentionLines(entry.text, pageId)
                return lines.map((lineHtml, li) => (
                  <TimelineEntryRow
                    key={`${entry.id}-${li}`}
                    entry={{ ...entry, text: lineHtml }}
                    onUpdate={NOOP}
                    onDelete={NOOP}
                    crossRefPageId={pageId}
                  />
                ))
              }
              return [(
                <TimelineEntryRow
                  key={entry.id}
                  entry={entry}
                  onUpdate={handleUpdateEntry}
                  onDelete={handleDeleteEntry}
                />
              )]
            })}
          </div>
          <span className={styles.sectionDate}>{formatEntryDate(new Date(dateKey))}</span>
        </div>
      ))}
    </div>
  )
}
