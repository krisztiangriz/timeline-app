import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { stripHtml } from '../../utils/stripHtml'
import { filterHtmlToMentionLines } from '../../utils/mentionParser'

import { useTimelineEntries, useCrossRefEntries, addEntry, updateEntry, deleteEntry, mergePendingEntries } from '../../hooks/useTimeline'
import { getPagePath } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { formatEntryDate, startOfDay } from '../../utils/dateUtils'
import { TimelineEntryRow } from './TimelineEntryRow'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
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

/** Ensure each line in pending HTML has a checkbox. Used when migrating old entries. */
function ensureCheckboxes(html: string): string {
  if (!html.trim()) return ''
  // If HTML already has checkboxes throughout, return as-is
  if (html.includes('data-checkbox')) return html

  // Wrap plain text in a div with checkbox
  return `<div><span data-checkbox="false">\u00A0</span>${html}</div>`
}

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

  // Split entries into pending, today (direct + cross-ref), and history groups
  const { pendingEntry, todayEntry, todayCrossRefs, historyGroups } = useMemo(() => {
    const pendingEntries: TimelineEntry[] = []
    const dated = new Map<string, TimelineEntry[]>()

    for (const entry of allEntries) {
      if (entry.isPending) {
        pendingEntries.push(entry)
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

    // Use first pending entry as the single pending record (after migration, there should be at most one)
    const singlePending = pendingEntries[0] ?? undefined

    return { pendingEntry: singlePending, todayEntry: todayDirect, todayCrossRefs: todayCrossRefEntries, historyGroups: history }
  }, [allEntries, directIds])

  // ---- Migration: merge multiple pending entries into one ----
  const migrationDone = useRef(false)
  useEffect(() => {
    if (migrationDone.current) return
    migrationDone.current = true
    // Check if there are multiple pending entries that need merging
    const pendingCount = allEntries.filter((e) => e.isPending).length
    if (pendingCount > 1) {
      mergePendingEntries(pageId)
    }
  }, [pageId, allEntries])

  // ---- Pending section state (single editor, mirrors Today pattern) ----
  const [pendingHtml, setPendingHtml] = useState('')
  const pendingEntryId = useRef<number | undefined>(undefined)
  const pendingFocusedRef = useRef(false)

  // Sync pending entry from DB → local state (only when editor is not focused)
  useEffect(() => {
    if (pendingEntry) {
      pendingEntryId.current = pendingEntry.id
      if (!pendingFocusedRef.current) {
        setPendingHtml(pendingEntry.text)
      }
    } else {
      pendingEntryId.current = undefined
      if (!pendingFocusedRef.current) {
        setPendingHtml('')
      }
    }
  }, [pendingEntry])

  // ---- Today's content as a single editable block ----
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

  async function handlePendingSave() {
    pendingFocusedRef.current = false
    const plain = stripHtml(pendingHtml).replace(/\u00A0/g, '').trim()

    if (pendingEntryId.current) {
      if (!plain) {
        await deleteEntry(pendingEntryId.current)
        pendingEntryId.current = undefined
      } else if (pendingHtml !== (pendingEntry?.text ?? '')) {
        await updateEntry(pendingEntryId.current, { text: pendingHtml })
      }
    } else if (plain) {
      // Ensure the new content has checkboxes
      const htmlWithCheckboxes = ensureCheckboxes(pendingHtml)
      const id = await addEntry({ pageId, text: htmlWithCheckboxes || pendingHtml, isPending: true })
      pendingEntryId.current = id
    }
  }

  async function handleCheckboxComplete(lineHtml: string, remainingHtml: string) {
    const cleanText = toSentenceCase(stripCheckboxHtml(lineHtml).replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ').trim())
    if (cleanText) {
      // Append to today's content
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
    // Immediately persist the pending record with the line removed
    setPendingHtml(remainingHtml)
    const plain = stripHtml(remainingHtml).trim()
    if (pendingEntryId.current) {
      if (!plain) {
        await deleteEntry(pendingEntryId.current)
        pendingEntryId.current = undefined
      } else {
        await updateEntry(pendingEntryId.current, { text: remainingHtml })
      }
    }
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

  const handleUpdateEntry = useCallback(async (id: number, data: { text?: string }) => {
    await updateEntry(id, data)
  }, [])

  const handleDeleteEntry = useCallback(async (id: number) => {
    await deleteEntry(id)
  }, [])

  async function handleDeletePending() {
    if (pendingEntryId.current) {
      await deleteEntry(pendingEntryId.current)
      pendingEntryId.current = undefined
      setPendingHtml('')
    }
  }

  async function handleDeleteToday() {
    if (todayEntryId.current) {
      await deleteEntry(todayEntryId.current)
      todayEntryId.current = undefined
      setTodayHtml('')
    }
  }

  async function handleDeleteHistoryEntry(entryId: number) {
    await deleteEntry(entryId)
  }

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

      {/* Pending section — single editor with auto-checkboxes */}
      {!readOnly && (
        <div className={styles.section}>
          <div className={styles.sectionContent}>
            <div onFocus={() => { pendingFocusedRef.current = true }}>
              <RichTextEditor
                value={pendingHtml}
                onChange={setPendingHtml}
                onBlur={handlePendingSave}
                onMentionClick={handleMentionClick}
                placeholder="Add a task…"
                autoCheckbox
                onCheckboxComplete={handleCheckboxComplete}
                collapseMentions
              />
            </div>
          </div>
          <div className={styles.sectionDateContainer}>
            <span className={styles.sectionDate}>Pending</span>
            <span className={styles.sectionDeleteLabel} onClick={handleDeletePending}>Delete</span>
          </div>
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
                collapseMentions
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
        <div className={styles.sectionDateContainer}>
          <span className={styles.sectionDate}>Today</span>
          <span className={styles.sectionDeleteLabel} onClick={handleDeleteToday}>Delete</span>
        </div>
      </div>

      {/* History sections */}
      {historyGroups.map(([dateKey, entries]) => {
        const directEntry = entries.find((e) => directIds.has(e.id!))
        return (
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
            <div className={styles.sectionDateContainer}>
              <span className={styles.sectionDate}>{formatEntryDate(new Date(dateKey))}</span>
              {directEntry && (
                <span className={styles.sectionDeleteLabel} onClick={() => handleDeleteHistoryEntry(directEntry.id!)}>Delete</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
