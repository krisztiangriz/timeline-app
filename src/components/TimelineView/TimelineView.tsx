import { useState, useMemo, useRef, useCallback, memo } from 'react'
import { stripHtml, stripCheckboxHtml } from '../../utils/stripHtml'
import { filterHtmlToMentionLines } from '../../utils/mentionParser'

import { useTimelineEntries, useCrossRefEntries, usePendingEntry, addEntry, updateEntry, deleteEntry } from '../../hooks/useTimeline'
import { usePageByRole, useChildPages } from '../../hooks/usePages'
import { useNavigateToPage } from '../../hooks/useNavigateToPage'
import { useToast } from '../../hooks/useToast'
import { useEntrySave } from '../../hooks/useEntryPersist'
import { useEditorSync } from '../../hooks/useEditorSync'
import { formatEntryDate, startOfDay } from '../../utils/dateUtils'
import { TimelineEntryRow } from './TimelineEntryRow'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { RichTextDisplay } from '../RichTextEditor/RichTextDisplay'
import { AddHistoricEntryModal } from './AddHistoricEntryModal'
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

/** Filtered pending tasks shown on non-main-timeline pages (read-only cross-refs) */
const FilteredPendingSection = memo(function FilteredPendingSection({
  filteredLines,
  filteredOriginalIndices,
}: {
  filteredLines: string[]
  filteredOriginalIndices: number[]
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionContent}>
        {filteredLines.map((lineHtml, i) => (
          <div key={filteredOriginalIndices[i]} className={styles.filteredPendingLine}>
            <RichTextDisplay html={lineHtml} collapseMentions />
          </div>
        ))}
      </div>
      <div className={styles.sectionDateContainer}>
        <span className={styles.sectionDate}>Sticky</span>
      </div>
    </div>
  )
})

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
  page?: Page
}

export function TimelineView({ pageId, page }: TimelineViewProps) {
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

  // ---- Pending section state ----
  const { html: pendingHtml, setHtml: setPendingHtml, entryIdRef: pendingEntryId, focusedRef: pendingFocusedRef } = useEditorSync(pendingEntry)
  const pendingSectionRef = useRef<HTMLDivElement>(null)

  // Onboarding: trigger pending-tasks guide on first focus
  const { triggerGuide } = useOnboardingActions()

  // ---- Today's content as a single editable block ----
  const { html: todayHtml, setHtml: setTodayHtml, entryIdRef: todayEntryId, focusedRef: todayFocusedRef } = useEditorSync(todayEntry)

  // ---- History cross-ref editor state (for adding context to cross-ref-only sections) ----
  const [historyEditHtml, setHistoryEditHtml] = useState('')
  const historyEntryIdRef = useRef<number | undefined>(undefined)
  const historyEditDateRef = useRef<Date | undefined>(undefined)

  // ---- Add historic entry modal ----
  const [addHistoricModalOpen, setAddHistoricModalOpen] = useState(false)


  // ---- Save/auto-save hooks ----

  const pendingTextTransform = useCallback((html: string) => stripHtml(html).replace(/ /g, '').trim(), [])
  const { save: pendingSave, autoSave: autoSavePending } = useEntrySave(
    pendingEntryId,
    { pageId, isPending: true, textTransform: pendingTextTransform },
    showToast,
  )
  const { save: todaySave, autoSave: autoSaveToday } = useEntrySave(
    todayEntryId,
    { pageId, isPending: false },
    showToast,
  )
  async function handlePendingSave() {
    pendingFocusedRef.current = false
    await pendingSave(pendingHtml)
  }

  async function handleTodaySave() {
    todayFocusedRef.current = false
    await todaySave(todayHtml)
  }

  const { save: historySave, autoSave: autoSaveHistory } = useEntrySave(
    historyEntryIdRef,
    { pageId, isPending: false, date: historyEditDateRef.current },
    showToast,
  )

  const handleHistorySave = useCallback(async () => {
    await historySave(historyEditHtml)
  }, [historySave, historyEditHtml])

  // ---- Checkbox completion (moves pending line to today) ----

  async function handleCheckboxComplete(lineHtml: string, remainingHtml: string) {
    try {
      const cleanText = stripCheckboxHtml(lineHtml).replace(/ /g, ' ').replace(/&nbsp;/g, ' ').trim()
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
    if (isMainTimeline) keys.push('pending')
    keys.push('today')
    for (const [dateKey] of historyGroups) {
      keys.push(`history-${dateKey}`)
    }
    return keys
  }, [isMainTimeline, historyGroups])

  const focusSection = useCallback((key: string) => {
    const el = sectionRefsMap.current.get(key)
    el?.focus()
  }, [])


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
      if (sectionKey.startsWith('history-')) {
        const dateKey = sectionKey.replace('history-', '')
        const group = historyGroups.find(([k]) => k === dateKey)
        const hasDirect = group?.[1].some((ent) => directIds.has(ent.id!))
        if (!hasDirect) {
          historyEditDateRef.current = new Date(dateKey)
          historyEntryIdRef.current = undefined
          setHistoryEditHtml('')
        }
      }
      setEditingSection(sectionKey)
      return
    }

  }, [sectionKeys, focusSection, historyGroups, directIds])

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


  return (
    <div className={styles.timeline}>
      {/* Pending section */}
      {isMainTimeline && (
        <div
          className={editingSection === 'pending' ? styles.section : styles.sectionFocusable}
          ref={(el) => { pendingSectionRef.current = el; setSectionRef('pending')(el) }}
          tabIndex={editingSection === 'pending' ? undefined : 0}
          role="region"
          aria-label="Sticky tasks"
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
            <span className={styles.sectionDate}>Sticky</span>
          </div>
        </div>
      )}
      {isMainTimeline && <OnboardingGuide guideId="pending-tasks" anchorRef={pendingSectionRef} position="bottom-left" />}

      {/* Filtered pending section (non-main-timeline pages) */}
      {!isMainTimeline && filteredLines.length > 0 && (
        <FilteredPendingSection
          filteredLines={filteredLines}
          filteredOriginalIndices={filteredOriginalIndices}
        />
      )}

      {/* Today section — editor in write mode, cross-refs always */}
      <div
        className={editingSection === 'today' ? styles.section : styles.sectionFocusable}
        ref={setSectionRef('today')}
        tabIndex={editingSection !== 'today' ? 0 : undefined}
        role="region"
        aria-label="Today"
        onKeyDown={(e) => handleSectionKeyDown('today', e)}
        onClick={(e) => handleSectionClick('today', e)}
      >
        <div className={styles.sectionContent}>
          {editingSection === 'today' ? (
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
          ) : todayHtml ? (
            <RichTextDisplay html={todayHtml} collapseMentions />
          ) : (
            <span className={styles.placeholderText}>Type here…</span>
          )}
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
            ref={setSectionRef(sectionKey)}
            tabIndex={!isEditing ? 0 : undefined}
            role="region"
            aria-label={formatEntryDate(new Date(dateKey))}
            onKeyDown={(e) => handleSectionKeyDown(sectionKey, e)}
            onClick={(e) => {
              handleSectionClick(sectionKey, e)
              if (!directEntry) {
                historyEditDateRef.current = new Date(dateKey)
                historyEntryIdRef.current = undefined
                setHistoryEditHtml('')
              }
            }}
          >
            <div className={styles.sectionContent}>
              {directEntry && (
                <TimelineEntryRow
                  key={directEntry.id}
                  entry={directEntry}
                  onUpdate={updateEntry}
                  onDelete={deleteEntry}
                  editing={isEditing}
                  onStartEditing={() => setEditingSection(sectionKey)}
                  onEscape={() => handleSectionEscape(sectionKey)}
                  onMentionClick={handleMentionClick}
                />
              )}
              {isEditing && !directEntry && (
                <RichTextEditor
                  value={historyEditHtml}
                  onChange={setHistoryEditHtml}
                  onBlur={handleHistorySave}
                  onAutoSave={autoSaveHistory}
                  onMentionClick={handleMentionClick}
                  onEscape={() => handleSectionEscape(sectionKey)}
                  placeholder="Add context…"
                  autoFocus
                  collapseMentions
                />
              )}
              {entries.flatMap((entry) => {
                if (directIds.has(entry.id!)) return []
                const lines = historyCrossRefLines.get(entry.id!) ?? []
                return lines.map((lineHtml, li) => (
                  <CrossRefRow
                    key={`${entry.id}-${li}`}
                    html={lineHtml}
                  />
                ))
              })}
            </div>
            <div className={styles.sectionDateContainer}>
              <span className={styles.sectionDate}>{formatEntryDate(new Date(dateKey))}</span>
            </div>
          </div>
        )
      })}

      {/* Add past entry */}
      <button
        className={styles.addHistoricButton}
        onClick={() => setAddHistoricModalOpen(true)}
        aria-label="Add past entry"
        tabIndex={0}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add Past Entry
      </button>
      <AddHistoricEntryModal
        open={addHistoricModalOpen}
        onClose={() => setAddHistoricModalOpen(false)}
        pageId={pageId}
        onToast={showToast}
      />
    </div>
  )
}
