import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { stripHtml, stripCheckboxHtml } from '../../utils/stripHtml'
import { filterHtmlToMentionLines, extractMentionPageIds } from '../../utils/mentionParser'

import Dexie from 'dexie'
import { useTimelineEntries, useCrossRefEntries, usePendingEntry, addEntry, updateEntry, deleteEntry, mergePendingEntries } from '../../hooks/useTimeline'
import { usePageByRole, useChildPages } from '../../hooks/usePages'
import { db } from '../../db/database'
import { useNavigateToPage } from '../../hooks/useNavigateToPage'
import { useToast } from '../../hooks/useToast'
import { formatEntryDate, startOfDay } from '../../utils/dateUtils'
import { TimelineEntryRow } from './TimelineEntryRow'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { RichTextDisplay } from '../RichTextEditor/RichTextDisplay'
import type { TimelineEntry, Page } from '../../types'
import { useOnboardingActions } from '../../hooks/useOnboardingGuides'
import { OnboardingGuide } from '../OnboardingGuide/OnboardingGuide'
import { sanitizeForEditor } from '../../utils/domPurify'
import styles from './TimelineView.module.css'

/** Lightweight read-only row for cross-referenced entries — avoids unstable object spread */
const CrossRefRow = memo(function CrossRefRow({ html }: { html: string }) {
  return (
    <div className={styles.entryRowTextDisabled} style={{ cursor: 'auto' }}>
      <RichTextDisplay html={html} collapseMentions />
    </div>
  )
})

/** Ensure each line in pending HTML has a checkbox. Used when migrating old entries. */
function ensureCheckboxes(html: string): string {
  if (!html.trim()) return ''
  // If HTML already has checkboxes throughout, return as-is
  if (html.includes('data-checkbox')) return html

  // Wrap plain text in a div with checkbox
  return `<div><span data-checkbox="false">\u00A0</span>${html}</div>`
}

/** Split pending HTML into individual line strings (inner content of each top-level <div>) */
function splitPendingLines(html: string): string[] {
  if (!html.trim()) return []
  const container = document.createElement('div')
  container.innerHTML = sanitizeForEditor(html)
  const lines: string[] = []
  for (const child of Array.from(container.children)) {
    if (child.tagName === 'DIV' && child.innerHTML.trim()) {
      lines.push(child.innerHTML)
    }
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
  const { show: showToast } = useToast()

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

  // Memoize today's key — stable for the lifetime of the component (day doesn't change mid-session)
  const todayKey = useMemo(() => startOfDay(new Date()).toISOString(), [])

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

    const todayAll = dated.get(todayKey) ?? []
    // Direct today entry = the one owned by this page
    const todayDirect = todayAll.find((e) => directIds.has(e.id!))
    // Cross-ref today entries = from other pages that mention this page
    const todayCrossRefEntries = todayAll.filter((e) => !directIds.has(e.id!))
    const history = sortedGroups.filter(([key]) => key !== todayKey)

    // Use first pending entry as the single pending record (after migration, there should be at most one)
    const singlePending = pendingEntries[0] ?? undefined

    return { pendingEntry: singlePending, todayEntry: todayDirect, todayCrossRefs: todayCrossRefEntries, historyGroups: history }
  }, [allEntries, directIds, todayKey])

  // Memoize cross-ref line splitting (avoids DOM parsing on every render)
  const todayCrossRefLines = useMemo(() =>
    todayCrossRefs.map((entry) => ({
      entry,
      lines: filterHtmlToMentionLines(entry.text, pageId),
    })),
    [todayCrossRefs, pageId]
  )

  const historyCrossRefLines = useMemo(() => {
    if (crossRefEntries.length === 0) return new Map<number, string[]>()
    const map = new Map<number, string[]>()
    for (const [, entries] of historyGroups) {
      for (const entry of entries) {
        if (!directIds.has(entry.id!)) {
          map.set(entry.id!, filterHtmlToMentionLines(entry.text, pageId))
        }
      }
    }
    return map
  }, [historyGroups, directIds, pageId, crossRefEntries.length])

  // ---- Migration: merge multiple pending entries into one ----
  const migrationDone = useRef(false)
  useEffect(() => {
    if (migrationDone.current) return
    migrationDone.current = true
    const pendingCount = allEntries.filter((e) => e.isPending).length
    if (pendingCount > 1) {
      mergePendingEntries(pageId).catch(() => { /* merge failure non-critical — entries still display individually */ })
    }
  }, [pageId]) // eslint-disable-line react-hooks/exhaustive-deps — guarded by migrationDone ref, only needs to run once per mount

  // ---- Pending section state (single editor, mirrors Today pattern) ----
  const [pendingHtml, setPendingHtml] = useState('')
  const pendingEntryId = useRef<number | undefined>(undefined)
  const pendingFocusedRef = useRef(false)
  const pendingSectionRef = useRef<HTMLDivElement>(null)

  // Onboarding: trigger pending-tasks guide on first focus
  const { triggerGuide } = useOnboardingActions()

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
      const cleanText = stripCheckboxHtml(lineHtml).replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ').trim()
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

  const handleDeletePending = useCallback(async () => {
    if (pendingEntryId.current) {
      const entryId = pendingEntryId.current
      const savedHtml = pendingHtml
      const savedDate = pendingEntry?.date
      const savedCreatedAt = pendingEntry?.createdAt
      try {
        await deleteEntry(entryId)
      } catch { showToast('Failed to delete'); return }
      pendingEntryId.current = undefined
      setPendingHtml('')
      showToast('Deleted', {
        label: 'Undo',
        onClick: async () => {
          if (pendingEntryId.current) return
          const id = await db.timelineEntries.add({
            pageId, text: savedHtml, isPending: true,
            date: savedDate ?? new Date(),
            tagRefs: extractMentionPageIds(savedHtml),
            createdAt: savedCreatedAt ?? new Date(),
            updatedAt: new Date(),
          })
          pendingEntryId.current = id as number
          setPendingHtml(savedHtml)
        },
      })
    }
  }, [pendingHtml, pendingEntry, pageId, showToast])

  const handleDeleteToday = useCallback(async () => {
    if (todayEntryId.current) {
      const entryId = todayEntryId.current
      const savedHtml = todayHtml
      const savedDate = todayEntry?.date
      const savedCreatedAt = todayEntry?.createdAt
      try {
        await deleteEntry(entryId)
      } catch { showToast('Failed to delete'); return }
      todayEntryId.current = undefined
      setTodayHtml('')
      showToast('Deleted', {
        label: 'Undo',
        onClick: async () => {
          if (todayEntryId.current) return
          const id = await db.timelineEntries.add({
            pageId, text: savedHtml, isPending: false,
            date: savedDate ?? new Date(),
            tagRefs: extractMentionPageIds(savedHtml),
            createdAt: savedCreatedAt ?? new Date(),
            updatedAt: new Date(),
          })
          todayEntryId.current = id as number
          setTodayHtml(savedHtml)
        },
      })
    }
  }, [todayHtml, todayEntry, pageId, showToast])

  // Auto-save handlers (persist only, no UI state changes)
  const autoSaveToday = useCallback(async (html: string) => {
    try {
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
    } catch { /* auto-save failure — non-critical */ }
  }, [pageId])

  const autoSavePending = useCallback(async (html: string) => {
    try {
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
    } catch { /* auto-save failure — non-critical */ }
  }, [pageId])

  const handleMentionClick = useNavigateToPage()

  // ---- Page type determination (needed before section nav and filtered pending) ----
  const isMainTimeline = page?.role === 'main-timeline'

  // ---- Section navigation state ----
  // Sections: 'pending' | 'today' | `history-${dateKey}` (one per history group with a direct entry)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const sectionRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const setSectionRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    if (el) {
      sectionRefsMap.current.set(key, el)
    } else {
      sectionRefsMap.current.delete(key)
    }
  }, [])

  // Build ordered list of navigable section keys
  const sectionKeys = useMemo(() => {
    const keys: string[] = []
    if (!readOnly && isMainTimeline) keys.push('pending')
    if (!readOnly) keys.push('today')
    for (const [dateKey, entries] of historyGroups) {
      if (entries.some((e) => directIds.has(e.id!))) {
        keys.push(`history-${dateKey}`)
      }
    }
    return keys
  }, [readOnly, isMainTimeline, historyGroups, directIds])

  const focusSection = useCallback((key: string) => {
    const el = sectionRefsMap.current.get(key)
    el?.focus()
  }, [])

  const handleDeleteHistory = useCallback(async (entry: TimelineEntry) => {
    const savedText = entry.text
    const savedDate = entry.date
    const savedCreatedAt = entry.createdAt
    try {
      await deleteEntry(entry.id!)
    } catch { showToast('Failed to delete'); return }
    showToast('Deleted', {
      label: 'Undo',
      onClick: async () => {
        await db.timelineEntries.add({
          pageId, text: savedText, isPending: false,
          date: savedDate,
          tagRefs: extractMentionPageIds(savedText),
          createdAt: savedCreatedAt, updatedAt: new Date(),
        })
      },
    })
  }, [pageId, showToast])

  const handleSectionKeyDown = useCallback((sectionKey: string, e: React.KeyboardEvent) => {
    // Only handle when the section div itself is focused (not a child editor)
    if (e.target !== e.currentTarget) return

    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      const idx = sectionKeys.indexOf(sectionKey)
      if (idx < sectionKeys.length - 1) {
        e.preventDefault()
        focusSection(sectionKeys[idx + 1])
      } else if (e.key === 'Tab') {
        // Let Tab leave the timeline at the end
        return
      } else {
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      const idx = sectionKeys.indexOf(sectionKey)
      if (idx > 0) {
        e.preventDefault()
        focusSection(sectionKeys[idx - 1])
      } else if (e.key === 'Tab') {
        // Let Shift+Tab leave the timeline at the beginning
        return
      } else {
        e.preventDefault()
      }
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setEditingSection(sectionKey)
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      // Move focus to adjacent section before deleting
      const idx = sectionKeys.indexOf(sectionKey)
      const nextKey = sectionKeys[idx + 1] ?? sectionKeys[idx - 1]
      if (nextKey) focusSection(nextKey)

      if (sectionKey === 'pending') handleDeletePending()
      else if (sectionKey === 'today') handleDeleteToday()
      else if (sectionKey.startsWith('history-')) {
        const dateKey = sectionKey.replace('history-', '')
        const group = historyGroups.find(([k]) => k === dateKey)
        const directEntry = group?.[1].find((ent) => directIds.has(ent.id!))
        if (directEntry) handleDeleteHistory(directEntry)
      }
    }
  }, [sectionKeys, focusSection, handleDeletePending, handleDeleteToday, handleDeleteHistory, historyGroups, directIds])

  const handleSectionEscape = useCallback((sectionKey: string) => {
    setEditingSection(null)
    // Return focus to the section div
    requestAnimationFrame(() => focusSection(sectionKey))
  }, [focusSection])

  const handleSectionClick = useCallback((sectionKey: string, e: React.MouseEvent) => {
    // Don't enter edit mode if clicking on a mention link
    const target = e.target as HTMLElement
    if (target.closest('[data-page-id]')) return
    // Don't enter edit mode if clicking on a button (delete, checkbox)
    if (target.closest('button')) return

    setEditingSection(sectionKey)
  }, [])

  // ---- Filtered pending (for non-main-timeline pages) ----
  const mainTimelinePage = usePageByRole(isMainTimeline ? undefined : 'main-timeline')
  const mainPendingEntry = usePendingEntry(isMainTimeline ? undefined : mainTimelinePage?.id)
  const hubChildren = useChildPages(page?.type === 'hub' ? page.id : undefined)

  // Determine which page IDs are relevant for filtering
  const relevantIds = useMemo(() => {
    if (isMainTimeline) return new Set<number>()
    if (page?.type === 'hub') return new Set(hubChildren.map((c) => c.id!))
    return new Set([pageId])
  }, [isMainTimeline, page, pageId, hubChildren])

  // Split and filter the main timeline's pending HTML
  const { filteredLines, filteredOriginalIndices } = useMemo(() => {
    if (isMainTimeline || !mainPendingEntry?.text) return { filteredLines: [], filteredOriginalIndices: [] }
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
    return { filteredLines: filtered, filteredOriginalIndices: indices }
  }, [isMainTimeline, mainPendingEntry?.text, relevantIds])

  // Handle completion of a filtered pending item
  async function handleFilteredComplete(lineIndex: number) {
    if (!mainPendingEntry?.id || !mainTimelinePage?.id) return
    try {
      // Re-read the pending entry from DB to avoid stale closure data
      const freshEntry = await db.timelineEntries.get(mainPendingEntry.id)
      if (!freshEntry) return
      const freshLines = splitPendingLines(freshEntry.text)

      const targetLine = filteredLines[lineIndex]
      const cleanText = stripCheckboxHtml(targetLine).replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ').trim()

      // Use the pre-computed original index (avoids false matches on duplicate content)
      const originalIndex = filteredOriginalIndices[lineIndex]
      if (originalIndex == null || originalIndex >= freshLines.length) { showToast('Task was already completed'); return }
      const remaining = [...freshLines]
      remaining.splice(originalIndex, 1)
      const newHtml = remaining.length > 0 ? remaining.map((l) => `<div>${l}</div>`).join('') : ''

      // Update or delete the main timeline pending entry
      const plain = stripHtml(newHtml).trim()
      if (plain) {
        await updateEntry(mainPendingEntry.id, { text: newHtml })
      } else {
        await deleteEntry(mainPendingEntry.id)
      }

      // Append to today's entry on the main timeline — use [pageId+date] index
      if (cleanText) {
        const todayStart = startOfDay(new Date())
        const mainTodayEntries = await db.timelineEntries
          .where('[pageId+date]')
          .between([mainTimelinePage.id, todayStart], [mainTimelinePage.id, Dexie.maxKey])
          .filter((e) => !e.isPending)
          .toArray()
        const mainTodayEntry = mainTodayEntries[0]
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
        <div
          className={editingSection === 'pending' ? styles.section : styles.sectionFocusable}
          ref={(el) => { pendingSectionRef.current = el; setSectionRef('pending')(el) }}
          tabIndex={editingSection === 'pending' ? undefined : 0}
          role="region"
          aria-label="Pending tasks"
          onKeyDown={(e) => handleSectionKeyDown('pending', e)}
          onClick={(e) => handleSectionClick('pending', e)}
        >
          <div className={styles.sectionContent}>
            {editingSection === 'pending' ? (
              <div onFocus={() => { pendingFocusedRef.current = true; triggerGuide('pending-tasks') }}>
                <RichTextEditor
                  value={pendingHtml}
                  onChange={setPendingHtml}
                  onBlur={handlePendingSave}
                  onAutoSave={autoSavePending}
                  onMentionClick={handleMentionClick}
                  onEscape={() => handleSectionEscape('pending')}
                  placeholder="Add a task…"
                  autoFocus
                  autoCheckbox
                  onCheckboxComplete={handleCheckboxComplete}
                  collapseMentions
                />
              </div>
            ) : pendingHtml ? (
              <RichTextDisplay html={pendingHtml} collapseMentions />
            ) : (
              <span className={styles.placeholderText}>Add a task…</span>
            )}
          </div>
          <div className={styles.sectionDateContainer}>
            <span className={styles.sectionDate}>Pending</span>
            <button className={styles.sectionDeleteLabel} onClick={handleDeletePending} aria-label="Delete pending tasks" tabIndex={-1}>Delete</button>
          </div>
        </div>
      )}
      {!readOnly && isMainTimeline && <OnboardingGuide guideId="pending-tasks" anchorRef={pendingSectionRef} position="bottom-left" />}

      {/* Filtered pending section (non-main-timeline pages) */}
      {!readOnly && !isMainTimeline && filteredLines.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionContent}>
            {filteredLines.map((lineHtml, i) => (
              <div key={filteredOriginalIndices[i]} className={styles.filteredPendingLine}>
                <span
                  className={styles.filteredCheckbox}
                  onClick={() => handleFilteredComplete(i)}
                  role="checkbox"
                  aria-checked="false"
                  aria-label="Complete task"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFilteredComplete(i) } }}
                />
                <RichTextDisplay html={stripCheckboxHtml(lineHtml)} collapseMentions />
              </div>
            ))}
          </div>
          <div className={styles.sectionDateContainer}>
            <span className={styles.sectionDate}>Pending</span>
          </div>
        </div>
      )}

      {/* Today section — editor in write mode, cross-refs always */}
      <div
        className={editingSection === 'today' ? styles.section : styles.sectionFocusable}
        ref={setSectionRef('today')}
        tabIndex={!readOnly && editingSection !== 'today' ? 0 : undefined}
        role="region"
        aria-label="Today"
        onKeyDown={(e) => handleSectionKeyDown('today', e)}
        onClick={(e) => handleSectionClick('today', e)}
      >
        <div className={styles.sectionContent}>
          {!readOnly && editingSection === 'today' ? (
            <div onFocus={() => { todayFocusedRef.current = true }}>
              <RichTextEditor
                value={todayHtml}
                onChange={setTodayHtml}
                onBlur={handleTodaySave}
                onAutoSave={autoSaveToday}
                onMentionClick={handleMentionClick}
                onEscape={() => handleSectionEscape('today')}
                placeholder="Type here…"
                autoFocus
                collapseMentions
              />
            </div>
          ) : !readOnly && todayHtml ? (
            <RichTextDisplay html={todayHtml} collapseMentions />
          ) : !readOnly ? (
            <span className={styles.placeholderText}>Type here…</span>
          ) : null}
          {todayCrossRefLines.flatMap(({ entry, lines }) =>
            lines.map((lineHtml, li) => (
              <CrossRefRow
                key={`${entry.id}-${li}`}
                html={lineHtml}
              />
            ))
          )}
        </div>
        <div className={styles.sectionDateContainer}>
          <span className={styles.sectionDate}>Today</span>
          <button className={styles.sectionDeleteLabel} onClick={handleDeleteToday} aria-label="Delete today's entry" tabIndex={-1}>Delete</button>
        </div>
      </div>

      {/* History sections */}
      {historyGroups.map(([dateKey, entries]) => {
        const directEntry = entries.find((e) => directIds.has(e.id!))
        const sectionKey = `history-${dateKey}`
        const isEditing = editingSection === sectionKey
        return (
          <div
            key={dateKey}
            className={isEditing ? styles.section : styles.sectionFocusable}
            ref={directEntry ? setSectionRef(sectionKey) : undefined}
            tabIndex={directEntry && !isEditing ? 0 : undefined}
            role="region"
            aria-label={formatEntryDate(new Date(dateKey))}
            onKeyDown={directEntry ? (e) => handleSectionKeyDown(sectionKey, e) : undefined}
            onClick={directEntry ? (e) => handleSectionClick(sectionKey, e) : undefined}
          >
            <div className={styles.sectionContent}>
              {entries.flatMap((entry) => {
                const isCrossRef = !directIds.has(entry.id!)
                if (isCrossRef) {
                  const lines = historyCrossRefLines.get(entry.id!) ?? []
                  return lines.map((lineHtml, li) => (
                    <CrossRefRow
                      key={`${entry.id}-${li}`}
                      html={lineHtml}
                    />
                  ))
                }
                return [(
                  <TimelineEntryRow
                    key={entry.id}
                    entry={entry}
                    onUpdate={updateEntry}
                    onDelete={deleteEntry}
                    editing={isEditing}
                    onStartEditing={() => setEditingSection(sectionKey)}
                    onEscape={() => handleSectionEscape(sectionKey)}
                    onMentionClick={handleMentionClick}
                  />
                )]
              })}
            </div>
            <div className={styles.sectionDateContainer}>
              <span className={styles.sectionDate}>{formatEntryDate(new Date(dateKey))}</span>
              {directEntry && (
                <button className={styles.sectionDeleteLabel} onClick={() => handleDeleteHistory(directEntry)} aria-label="Delete entry" tabIndex={-1}>Delete</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
