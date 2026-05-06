import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { useDimensions, addDimension, deleteDimension } from '../../hooks/useDimensions'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { usePageActions } from '../../hooks/usePages'
import { useModalContext, usePreferences } from '../../hooks/useAppContext'
import { useBackupSettings, type BackupFrequency } from '../../hooks/useAutoBackup'
import { useOnboardingGuides } from '../../hooks/useOnboardingGuides'
import { TrashIcon, CheckIcon, PlusIcon, CloseIcon, SearchIcon } from '../../components/Icons/Icons'
import { downloadExport, triggerImport, triggerMergeImport } from '../../utils/exportImport'
import type { Page } from '../../types'
import styles from './SettingsModal.module.css'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onToast: (msg: string) => void
}

export function SettingsModal({ open, onClose, onToast }: SettingsModalProps) {
  const dimensions = useDimensions()
  const { allPages } = useAutocomplete()
  const { updatePage } = usePageActions()
  const { showArchived, setShowArchived } = usePreferences()
  const { setOnboardingOpen } = useModalContext()
  const { frequency, setFrequency, lastBackup } = useBackupSettings()
  const { guidesDisabled, toggleGuides, resetAllGuides } = useOnboardingGuides()

  // Dimension add state
  const [addingDim, setAddingDim] = useState(false)
  const [newDimName, setNewDimName] = useState('')

  // Trigger add state
  const [addingTrigger, setAddingTrigger] = useState(false)
  const [triggerSearchQuery, setTriggerSearchQuery] = useState('')
  const [selectedTriggerPage, setSelectedTriggerPage] = useState<Page | null>(null)
  const [triggerSearchIndex, setTriggerSearchIndex] = useState(-1)
  const [newTriggerChar, setNewTriggerChar] = useState('')
  const triggerResultsRef = useRef<HTMLDivElement>(null)

  // Merge import state
  const [merging, setMerging] = useState(false)
  const [mergePageId, setMergePageId] = useState<number | undefined>()
  const [mergeQuery, setMergeQuery] = useState('')
  const [mergeSelected, setMergeSelected] = useState<Page | null>(null)
  const [mergeActiveIndex, setMergeActiveIndex] = useState(-1)
  const mergeResultsRef = useRef<HTMLDivElement>(null)

  // Merge lookup: filter pages by search query
  const mergeResults = useMemo(() => {
    if (!mergeQuery.trim()) return []
    const q = mergeQuery.toLowerCase()
    return allPages.filter(
      (p) => p.type !== 'hub' && p.name.toLowerCase().includes(q)
    )
  }, [mergeQuery, allPages])

  // Reset active index when merge results change
  useEffect(() => { setMergeActiveIndex(-1) }, [mergeResults.length])

  // Scroll active merge result into view
  useEffect(() => {
    if (mergeActiveIndex < 0 || !mergeResultsRef.current) return
    const el = mergeResultsRef.current.children[mergeActiveIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [mergeActiveIndex])

  // Pages with triggers (hubs + any page with a mentionTrigger)
  const triggerPages = allPages.filter((p) => p.type === 'hub' || p.mentionTrigger)
  // Pages available to add a trigger to (no trigger yet, not main-timeline)
  const availableForTrigger = allPages.filter((p) => !p.mentionTrigger && p.role !== 'main-timeline')

  // Trigger search results
  const triggerSearchResults = useMemo(() => {
    if (!triggerSearchQuery.trim()) return []
    const q = triggerSearchQuery.toLowerCase()
    return availableForTrigger.filter((p) => p.name.toLowerCase().includes(q))
  }, [triggerSearchQuery, availableForTrigger])

  useEffect(() => { setTriggerSearchIndex(-1) }, [triggerSearchResults.length])
  useEffect(() => {
    if (triggerSearchIndex < 0 || !triggerResultsRef.current) return
    const el = triggerResultsRef.current.children[triggerSearchIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [triggerSearchIndex])

  async function handleTriggerChange(pageId: number, value: string) {
    const ch = value.slice(0, 1)
    if (ch === '~' || /\s/.test(ch)) return
    const mentionTrigger = ch === '' ? undefined : ch
    await updatePage(pageId, { mentionTrigger })
  }

  async function handleRemoveTrigger(pageId: number) {
    await updatePage(pageId, { mentionTrigger: undefined })
  }

  async function handleAddTrigger() {
    if (!selectedTriggerPage || !newTriggerChar.trim()) return
    const ch = newTriggerChar.trim().slice(0, 1)
    if (ch === '~' || /\s/.test(ch)) return
    await updatePage(selectedTriggerPage.id!, { mentionTrigger: ch })
    cancelAddTrigger()
  }

  function cancelAddTrigger() {
    setTriggerSearchQuery('')
    setSelectedTriggerPage(null)
    setTriggerSearchIndex(-1)
    setNewTriggerChar('')
    setAddingTrigger(false)
  }

  async function handleAddDimension() {
    if (!newDimName.trim()) return
    await addDimension(newDimName.trim())
    cancelAddDim()
  }

  function cancelAddDim() {
    setNewDimName('')
    setAddingDim(false)
  }

  async function handleExport() {
    await downloadExport()
    onToast('Data exported')
  }

  async function handleImport() {
    try {
      await triggerImport()
      onToast('Data imported')
      onClose()
    } catch {
      onToast('Import failed')
    }
  }

  async function handleMergeImport() {
    const targetId = mergeSelected?.id ?? mergePageId
    if (!targetId) return
    try {
      const summary = await triggerMergeImport(targetId)
      if (summary) {
        onToast(summary)
        cancelMerge()
        onClose()
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Merge failed')
    }
  }

  function cancelMerge() {
    setMergePageId(undefined)
    setMergeQuery('')
    setMergeSelected(null)
    setMergeActiveIndex(-1)
    setMerging(false)
  }

  function handleMergeKeyDown(e: React.KeyboardEvent) {
    if (!mergeResults.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMergeActiveIndex((prev) => (prev < mergeResults.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMergeActiveIndex((prev) => (prev > 0 ? prev - 1 : mergeResults.length - 1))
    } else if (e.key === 'Enter' && mergeActiveIndex >= 0) {
      e.preventDefault()
      selectMergePage(mergeResults[mergeActiveIndex])
    }
  }

  function selectMergePage(page: Page) {
    setMergeSelected(page)
    setMergePageId(page.id)
    setMergeQuery('')
  }

  return (
    <Modal title="Settings" open={open} onClose={onClose} onConfirm={onClose}>
      {/* Data */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Data</span>
        <span className={styles.sectionDescription}>
          Export or Import all your data as JSON. Import replaces all existing data. Merge adds entries and feedback from a file without removing existing data.
        </span>
        <div className={styles.buttonRow}>
          <button className={styles.iconButton} onClick={handleExport}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M8.25 1.5V8.691L5.781 6.219L4.719 7.281L9 11.559L13.281 7.281L12.219 6.219L9.75 8.691V1.5H8.25ZM1.5 12.75V15C1.5 15.82 2.18 16.5 3 16.5H15C15.82 16.5 16.5 15.82 16.5 15V12.75H15V15H3V12.75H1.5Z" fill="currentColor" />
            </svg>
            Export
          </button>
          <button className={styles.iconButton} onClick={handleImport}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M8.25 12V5.559L5.781 8.031L4.719 6.969L9 2.691L13.281 6.969L12.219 8.031L9.75 5.559V12H8.25ZM1.5 12.75V15C1.5 15.82 2.18 16.5 3 16.5H15C15.82 16.5 16.5 15.82 16.5 15V12.75H15V15H3V12.75H1.5Z" fill="currentColor" />
            </svg>
            Import
          </button>
          <button className={styles.iconButton} onClick={() => setMerging(true)}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9 1.5C9.414 1.5 9.75 1.836 9.75 2.25V8.25H15.75C16.164 8.25 16.5 8.586 16.5 9C16.5 9.414 16.164 9.75 15.75 9.75H9.75V15.75C9.75 16.164 9.414 16.5 9 16.5C8.586 16.5 8.25 16.164 8.25 15.75V9.75H2.25C1.836 9.75 1.5 9.414 1.5 9C1.5 8.586 1.836 8.25 2.25 8.25H8.25V2.25C8.25 1.836 8.586 1.5 9 1.5Z" fill="currentColor" />
            </svg>
            Merge
          </button>
        </div>
        {merging && (
          <div className={styles.mergeRow}>
            {mergeSelected ? (
              <div className={styles.mergeSelectedPage}>
                <span>{mergeSelected.name}</span>
                <button
                  className={styles.mergeClearButton}
                  onClick={() => { setMergeSelected(null); setMergePageId(undefined) }}
                  aria-label="Clear selection"
                >
                  <CloseIcon size={10} />
                </button>
              </div>
            ) : (
              <div className={styles.mergeSearchWrapper}>
                <SearchIcon />
                <input
                  className={styles.mergeSearchInput}
                  type="text"
                  value={mergeQuery}
                  onChange={(e) => setMergeQuery(e.target.value)}
                  onKeyDown={handleMergeKeyDown}
                  placeholder="Look up a page"
                  autoFocus
                />
                {mergeQuery && (
                  <button className={styles.mergeClearButton} onClick={() => setMergeQuery('')} aria-label="Clear">
                    <PlusIcon size={12} />
                  </button>
                )}
                {mergeResults.length > 0 && (
                  <div className={styles.mergeSearchResults} ref={mergeResultsRef}>
                    {mergeResults.map((page, i) => (
                      <button
                        key={page.id}
                        className={i === mergeActiveIndex ? styles.mergeSearchResultActive : styles.mergeSearchResult}
                        onClick={() => selectMergePage(page)}
                        onMouseEnter={() => setMergeActiveIndex(i)}
                      >
                        {page.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className={styles.confirmButton} onClick={handleMergeImport} aria-label="Choose file"
              style={{ opacity: mergeSelected ? 1 : 0.4, pointerEvents: mergeSelected ? 'auto' : 'none' }}>{<CheckIcon />}</button>
            <button className={styles.deleteButton} onClick={cancelMerge} aria-label="Cancel merge">{<TrashIcon />}</button>
          </div>
        )}
      </div>

      {/* Auto-backup */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Auto-backup</span>
        <div className={styles.backupRow}>
          {(['daily', 'weekly', 'monthly', 'off'] as BackupFrequency[]).map((opt) => (
            <button key={opt} className={styles.checkboxRow} onClick={() => setFrequency(opt)}>
              <div className={styles.radio} data-checked={frequency === opt} />
              <span className={styles.checkboxLabel}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
            </button>
          ))}
        </div>
        <span className={styles.backupStatus}>
          {lastBackup
            ? `Last backup: ${new Date(lastBackup).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
            : 'No backups yet'}
        </span>
      </div>

      {/* Show / Hide */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Show / Hide</span>
        <div className={styles.showHideRow}>
          <button className={styles.checkboxRow} onClick={() => setShowArchived(!showArchived)}>
            <div className={styles.checkbox} data-checked={showArchived} />
            <span className={styles.checkboxLabel}>Show archived</span>
          </button>
          <button className={styles.checkboxRow} onClick={toggleGuides}>
            <div className={styles.checkbox} data-checked={!guidesDisabled} />
            <span className={styles.checkboxLabel}>Show onboarding hints</span>
          </button>
          <button className={styles.iconButton} onClick={() => {
            localStorage.removeItem('onboarding-completed')
            resetAllGuides()
            setOnboardingOpen(true)
            onClose()
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C10.85 4 9.75 4.2375 8.7 4.7125C7.65 5.1875 6.75 5.86667 6 6.75V4H4V11H11V9H6.8C7.33333 8.06667 8.0625 7.33333 8.9875 6.8C9.9125 6.26667 10.9167 6 12 6C13.6667 6 15.0833 6.58333 16.25 7.75C17.4167 8.91667 18 10.3333 18 12C18 13.6667 17.4167 15.0833 16.25 16.25C15.0833 17.4167 13.6667 18 12 18C10.7167 18 9.55833 17.6333 8.525 16.9C7.49167 16.1667 6.76667 15.2 6.35 14H4.25C4.71667 15.7667 5.66667 17.2083 7.1 18.325C8.53333 19.4417 10.1667 20 12 20Z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
            Reset onboarding
          </button>
        </div>
      </div>

      {/* Triggers */}
      <div className={styles.section}>
        <div className={styles.listHeader}>
          <span className={styles.sectionTitle}>Triggers</span>
          {!addingTrigger && availableForTrigger.length > 0 && (
            <button className={styles.addButton} onClick={() => setAddingTrigger(true)} aria-label="Add trigger">{<PlusIcon />}</button>
          )}
        </div>
        {triggerPages.length === 0 && !addingTrigger && (
          <span className={styles.emptyHint}>Add a trigger to mention pages quickly</span>
        )}
        {triggerPages.map((page) => (
          <div key={page.id} className={styles.listItem}>
            <span className={styles.itemName}>{page.name}</span>
            <input
              className={styles.colorInput}
              type="text"
              value={page.mentionTrigger ?? ''}
              onChange={(e) => handleTriggerChange(page.id!, e.target.value)}
              placeholder="trigger"
              style={{ width: 52 }}
            />
            <button
              className={styles.checkboxRow}
              onClick={() => updatePage(page.id!, { mentionCollapsed: !page.mentionCollapsed })}
              title={page.mentionCollapsed ? 'Showing trigger only — click to show full name' : 'Showing full name — click to show trigger only'}
            >
              <div className={styles.checkbox} data-checked={!page.mentionCollapsed} />
              <span className={styles.checkboxLabel}>Label</span>
            </button>
            <button className={styles.deleteButton} onClick={() => handleRemoveTrigger(page.id!)} aria-label={`Remove trigger from ${page.name}`}>{<TrashIcon />}</button>
          </div>
        ))}
        {addingTrigger && (
          <div className={styles.listItem}>
            <div className={styles.triggerInputGroup}>
              {selectedTriggerPage ? (
                <span className={styles.itemName}>
                  {selectedTriggerPage.name}
                  <button className={styles.clearTriggerSearch} onClick={() => { setSelectedTriggerPage(null); setTriggerSearchQuery('') }} aria-label="Clear">
                    <CloseIcon size={10} />
                  </button>
                </span>
              ) : (
                <div className={styles.triggerSearchWrapper}>
                  <input
                    className={styles.inlineInput}
                    type="text"
                    value={triggerSearchQuery}
                    onChange={(e) => setTriggerSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (!triggerSearchResults.length) return
                      if (e.key === 'ArrowDown') { e.preventDefault(); setTriggerSearchIndex((i) => (i < triggerSearchResults.length - 1 ? i + 1 : 0)) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setTriggerSearchIndex((i) => (i > 0 ? i - 1 : triggerSearchResults.length - 1)) }
                      else if (e.key === 'Enter' && triggerSearchIndex >= 0) { e.preventDefault(); setSelectedTriggerPage(triggerSearchResults[triggerSearchIndex]); setTriggerSearchQuery('') }
                    }}
                    placeholder="Search pages..."
                    autoFocus
                  />
                  {triggerSearchResults.length > 0 && (
                    <div className={styles.triggerSearchResults} ref={triggerResultsRef}>
                      {triggerSearchResults.map((p, i) => (
                        <button
                          key={p.id}
                          className={i === triggerSearchIndex ? styles.triggerSearchResultActive : styles.triggerSearchResult}
                          onClick={() => { setSelectedTriggerPage(p); setTriggerSearchQuery('') }}
                          onMouseEnter={() => setTriggerSearchIndex(i)}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <input
                className={styles.colorInput}
                type="text"
                value={newTriggerChar}
                onChange={(e) => {
                  const ch = e.target.value.slice(0, 1)
                  if (ch === '~' || /\s/.test(ch)) return
                  setNewTriggerChar(ch)
                }}
                placeholder="trigger"
                style={{ width: 52 }}
              />
            </div>
            <div className={styles.triggerButtonGroup}>
              <button className={styles.confirmButton} onClick={handleAddTrigger} aria-label="Confirm"
                style={{ opacity: selectedTriggerPage && newTriggerChar.trim() ? 1 : 0.4, pointerEvents: selectedTriggerPage && newTriggerChar.trim() ? 'auto' : 'none' }}>{<CheckIcon />}</button>
              <button className={styles.deleteButton} onClick={cancelAddTrigger} aria-label="Cancel">{<TrashIcon />}</button>
            </div>
          </div>
        )}
      </div>

      {/* Dimensions */}
      <div className={styles.section}>
        <div className={styles.listHeader}>
          <span className={styles.sectionTitle}>Feedback dimensions</span>
          <button className={styles.addButton} onClick={() => setAddingDim(true)} aria-label="Add dimension">{<PlusIcon />}</button>
        </div>
        {dimensions.length === 0 && !addingDim && (
          <span className={styles.emptyHint}>Add dimensions to categorize feedback</span>
        )}
        {dimensions.map((dim) => (
          <div key={dim.id} className={styles.listItem}>
            <span className={styles.itemName}>{dim.name}</span>
            <button className={styles.deleteButton} onClick={() => dim.id && deleteDimension(dim.id)} aria-label={`Delete ${dim.name}`}>{<TrashIcon />}</button>
          </div>
        ))}
        {addingDim && (
          <div className={styles.listItem}>
            <input className={styles.inlineInput} type="text" value={newDimName} onChange={(e) => setNewDimName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddDimension(); if (e.key === 'Escape') cancelAddDim() }}
              placeholder="Dimension name" autoFocus />
            <button className={styles.confirmButton} onClick={handleAddDimension} aria-label="Confirm"
              style={{ opacity: newDimName.trim() ? 1 : 0.4, pointerEvents: newDimName.trim() ? 'auto' : 'none' }}>{<CheckIcon />}</button>
            <button className={styles.deleteButton} onClick={cancelAddDim} aria-label="Cancel">{<TrashIcon />}</button>
          </div>
        )}
      </div>
    </Modal>
  )
}
