import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { stripHtml } from '../../utils/stripHtml'
import { filterHtmlToMentionLines } from '../../utils/mentionParser'

import { useTimelineEntries, useCrossRefEntries, addEntry, updateEntry, deleteEntry, mergePendingEntries } from '../../hooks/useTimeline'
import { usePageByRole, useChildPages, getPagePath } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useToast } from '../../hooks/useToast'
import { formatEntryDate, startOfDay } from '../../utils/dateUtils'
import { TimelineEntryRow } from './TimelineEntryRow'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { RichTextDisplay } from '../RichTextEditor/RichTextDisplay'
import type { TimelineEntry, Page } from '../../types'
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

/** Split pending HTML into individual line strings (inner content of each <div>) */
function splitPendingLines(html: string): string[] {
  if (!html.trim()) return []
  const lines: string[] = []
  const regex = /<div[^>]*>([\s\S]*?)<\/div>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    if (match[1].trim()) lines.push(match[1])
  }
  if (lines.length === 0 && html.trim()) lines.push(html.trim())
  return lines
}

// ---- Timeline view ----

interface TimelineViewProps {
  pageId: number
  title?: string
  /** If true, only show cross-ref entries — hide pending section and today editor */
  readOnly?: boolean
  /** Page object for determining pending filter behavior */
  page?: Page
}

export function TimelineView({ pageId, title, readOnly = false, page }: TimelineViewProps) {
  const directEntries = useTimelineEntries(pageId)
  const crossRefEntries = useCrossRefEntries(pageId)
  const { allPages } = useAutocomplete()
  const { show: showToast } = useToast()
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
    try {
      const plain = stripHtml(pendingHtml).replace(/\u00A0/g, '').trim()

      if (pendingEntryId.current) {
        if (!plain) {
          await deleteEntry(pendingEntryId.current)
          pendingEntryId.current = undefined
        } else if (pendingHtml !== (pendingEntry?.text ?? '')) {
          await updateEntry(pendingEntryId.current, { text: pendingHtml })
        }
      } else if (plain) {
        const htmlWithCheckboxes = ensureCheckboxes(pendingHtml)
        const id = await addEntry({ pageId, text: htmlWithCheckboxes || pendingHtml, isPending: true })
        pendingEntryId.current = id
      }
    } catch { showToast('Failed to save') }
  }

  async function handleCheckboxComplete(lineHtml: string, remainingHtml: string) {
    try {
      const cleanText = toSentenceCase(stripCheckboxHtml(lineHtml).replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ').trim())
      if (cleanText) {
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
    } catch { showToast('Failed to save') }
  }

  async function handleTodaySave() {
    todayFocusedRef.current = false
    try {
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
    } catch { showToast('Failed to save') }
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

  // Auto-save handlers (persist only, no UI state changes)
  const autoSaveToday = useCallback(async (html: string) => {
    const plain = stripHtml(html).trim()
    if (todayEntryId.current) {
      if (!plain) {
        await deleteEntry(todayEntryId.current)
        todayEntryId.current = undefined
      } else {
        await updateEntry(todayEntryId.current, { text: html })
      }
    } else if (plain) {
      const id = await addEntry({ pageId, text: html, isPending: false })
      todayEntryId.current = id
    }
  }, [pageId])

  const autoSavePending = useCallback(async (html: string) => {
    const plain = stripHtml(html).replace(/\u00A0/g, '').trim()
    if (pendingEntryId.current) {
      if (!plain) {
        await deleteEntry(pendingEntryId.current)
        pendingEntryId.current = undefined
      } else {
        await updateEntry(pendingEntryId.current, { text: html })
      }
    } else if (plain) {
      const htmlWithCheckboxes = ensureCheckboxes(html)
      const id = await addEntry({ pageId, text: htmlWithCheckboxes || html, isPending: true })
      pendingEntryId.current = id
    }
  }, [pageId])

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

  // ---- Filtered pending (for non-main-timeline pages) ----
  const isMainTimeline = page?.role === 'main-timeline'
  const mainTimelinePage = usePageByRole('main-timeline')
  const mainTimelineEntries = useTimelineEntries(isMainTimeline ? undefined : mainTimelinePage?.id)
  const hubChildren = useChildPages(page?.type === 'hub' ? page.id : undefined)

  const mainPendingEntry = useMemo(
    () => isMainTimeline ? undefined : mainTimelineEntries.find((e) => e.isPending),
    [mainTimelineEntries, isMainTimeline]
  )

  // Determine which page IDs are relevant for filtering
  const relevantIds = useMemo(() => {
    if (isMainTimeline) return new Set<number>()
    if (page?.type === 'hub') return new Set(hubChildren.map((c) => c.id!))
    return new Set([pageId])
  }, [isMainTimeline, page, pageId, hubChildren])

  // Split and filter the main timeline's pending HTML
  const { filteredLines, filteredOriginalIndices, allMainLines } = useMemo(() => {
    if (isMainTimeline || !mainPendingEntry?.text) return { filteredLines: [], filteredOriginalIndices: [], allMainLines: [] }
    const allLines = splitPendingLines(mainPendingEntry.text)
    const filtered: string[] = []
    const indices: number[] = []
    allLines.forEach((line, i) => {
      const matches = line.match(/data-page-id="(\d+)"/g)
      if (!matches) return
      const isRelevant = matches.some((m) => {
        const id = Number(m.replace('data-page-id="', '').replace('"', ''))
        return relevantIds.has(id)
      })
      if (isRelevant) {
        filtered.push(line)
        indices.push(i)
      }
    })
    return { filteredLines: filtered, filteredOriginalIndices: indices, allMainLines: allLines }
  }, [isMainTimeline, mainPendingEntry?.text, relevantIds])

  // Handle completion of a filtered pending item
  async function handleFilteredComplete(lineIndex: number) {
    if (!mainPendingEntry?.id || !mainTimelinePage?.id) return
    try {
      const targetLine = filteredLines[lineIndex]
      const cleanText = toSentenceCase(
        stripCheckboxHtml(targetLine).replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ').trim()
      )

      // Remove the line from the full pending HTML using tracked index
      const originalIndex = filteredOriginalIndices[lineIndex]
      if (originalIndex === undefined) return
      const remaining = [...allMainLines]
      remaining.splice(originalIndex, 1)
      const newHtml = remaining.length > 0 ? remaining.map((l) => `<div>${l}</div>`).join('') : ''

      // Update or delete the main timeline pending entry
      const plain = stripHtml(newHtml).trim()
      if (plain) {
        await updateEntry(mainPendingEntry.id, { text: newHtml })
      } else {
        await deleteEntry(mainPendingEntry.id)
      }

      // Append to today's entry on the main timeline
      if (cleanText) {
        const todayStart = startOfDay(new Date())
        const mainTodayEntry = mainTimelineEntries.find(
          (e) => !e.isPending && new Date(e.date) >= todayStart && e.pageId === mainTimelinePage.id
        )
        if (mainTodayEntry?.id) {
          const newText = mainTodayEntry.text
            ? mainTodayEntry.text + '<div>' + cleanText + '</div>'
            : cleanText
          await updateEntry(mainTodayEntry.id, { text: newText })
        } else {
          await addEntry({ pageId: mainTimelinePage.id, text: cleanText, isPending: false })
        }
      }
    } catch { showToast('Failed to save') }
  }

  return (
    <div className={styles.timeline}>
      {title && <span className={styles.sectionTitle}>{title}</span>}

      {/* Pending section */}
      {!readOnly && isMainTimeline && (
        <div className={styles.section}>
          <div className={styles.sectionContent}>
            <div onFocus={() => { pendingFocusedRef.current = true }}>
              <RichTextEditor
                value={pendingHtml}
                onChange={setPendingHtml}
                onBlur={handlePendingSave}
                onAutoSave={autoSavePending}
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

      {/* Filtered pending section (non-main-timeline pages) */}
      {!readOnly && !isMainTimeline && filteredLines.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionContent}>
            {filteredLines.map((lineHtml, i) => (
              <div key={i} className={styles.filteredPendingLine}>
                <span className={styles.filteredCheckbox} onClick={() => handleFilteredComplete(i)} />
                <RichTextDisplay html={stripCheckboxHtml(lineHtml)} collapseMentions />
              </div>
            ))}
          </div>
          <div className={styles.sectionDateContainer}>
            <span className={styles.sectionDate}>Pending</span>
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
                onAutoSave={autoSaveToday}
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
