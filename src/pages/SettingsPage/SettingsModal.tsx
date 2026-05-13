import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useModalContext, usePreferences } from '../../hooks/useAppContext'
import { useBackupSettings, type BackupFrequency } from '../../hooks/useAutoBackup'
import { useOnboardingGuides } from '../../hooks/useOnboardingGuides'
import { onboardingGuides } from '../../config/onboardingGuides'
import { TrashIcon, CheckIcon, PlusIcon, CloseIcon, SearchIcon } from '../../components/Icons/Icons'
import { downloadExport, triggerImport, triggerMergeImport } from '../../utils/exportImport'
import { useChartPalette, PALETTE_OPTIONS } from '../../hooks/useChartPalette'
import { useTheme, type Theme } from '../../hooks/useTheme'
import { ColorPicker } from '../../components/ColorPicker/ColorPicker'
import type { Page } from '../../types'
import styles from './SettingsModal.module.css'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onToast: (msg: string) => void
}

export function SettingsModal({ open, onClose, onToast }: SettingsModalProps) {
  const { allPages } = useAutocomplete()
  const { showArchived, setShowArchived } = usePreferences()
  const { setOnboardingOpen } = useModalContext()
  const { frequency, setFrequency, lastBackup } = useBackupSettings()
  const { resetAllGuides, isGuideDismissed } = useOnboardingGuides()
  const { palette, updateColor, resetPalette } = useChartPalette()
  const { theme, setTheme } = useTheme()
  const [palettePickerIndex, setPalettePickerIndex] = useState<number | null>(null)
  const paletteAnchorRef = useRef<HTMLButtonElement>(null)

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
      {/* Theme */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Theme</span>
        <div className={styles.backupRow}>
          {(['light', 'dark'] as Theme[]).map((opt) => (
            <button key={opt} className={styles.checkboxRow} onClick={() => setTheme(opt)}>
              <div className={styles.radio} data-checked={theme === opt} />
              <span className={styles.checkboxLabel}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

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

      {/* Chart colors */}
      <div className={styles.section}>
        <div className={styles.listHeader}>
          <span className={styles.sectionTitle}>Chart colors</span>
        </div>
        <div className={styles.paletteRow}>
          {palette.map((color, i) => (
            <div key={i} className={styles.colorSwatchWrapper}>
              <button
                className={styles.colorSwatch}
                style={{ background: color }}
                ref={palettePickerIndex === i ? paletteAnchorRef : undefined}
                onClick={(e) => {
                  if (palettePickerIndex === i) {
                    setPalettePickerIndex(null)
                  } else {
                    paletteAnchorRef.current = e.currentTarget as HTMLButtonElement
                    setPalettePickerIndex(i)
                  }
                }}
                aria-label={`Color ${i + 1}`}
              />
              {palettePickerIndex === i && (
                <ColorPicker
                  colors={PALETTE_OPTIONS}
                  value={color}
                  onChange={(c) => updateColor(i, c)}
                  onClose={() => setPalettePickerIndex(null)}
                  anchorRef={paletteAnchorRef}
                />
              )}
            </div>
          ))}
        </div>
        <button className={styles.iconButton} onClick={resetPalette}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C10.85 4 9.75 4.2375 8.7 4.7125C7.65 5.1875 6.75 5.86667 6 6.75V4H4V11H11V9H6.8C7.33333 8.06667 8.0625 7.33333 8.9875 6.8C9.9125 6.26667 10.9167 6 12 6C13.6667 6 15.0833 6.58333 16.25 7.75C17.4167 8.91667 18 10.3333 18 12C18 13.6667 17.4167 15.0833 16.25 16.25C15.0833 17.4167 13.6667 18 12 18C10.7167 18 9.55833 17.6333 8.525 16.9C7.49167 16.1667 6.76667 15.2 6.35 14H4.25C4.71667 15.7667 5.66667 17.2083 7.1 18.325C8.53333 19.4417 10.1667 20 12 20Z" fill="currentColor" fillOpacity="0.7" /></svg>
          Reset
        </button>
      </div>

      {/* Onboarding */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Onboarding</span>
        <span className={styles.backupStatus}>Status: {onboardingGuides.filter((g) => isGuideDismissed(g.id)).length}/{onboardingGuides.length}</span>
        <div className={styles.showHideRow}>
          <button className={styles.iconButton} onClick={() => {
            localStorage.removeItem('onboarding-completed')
            localStorage.removeItem('user-created-page')
            resetAllGuides()
            setOnboardingOpen(true)
            onClose()
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C10.85 4 9.75 4.2375 8.7 4.7125C7.65 5.1875 6.75 5.86667 6 6.75V4H4V11H11V9H6.8C7.33333 8.06667 8.0625 7.33333 8.9875 6.8C9.9125 6.26667 10.9167 6 12 6C13.6667 6 15.0833 6.58333 16.25 7.75C17.4167 8.91667 18 10.3333 18 12C18 13.6667 17.4167 15.0833 16.25 16.25C15.0833 17.4167 13.6667 18 12 18C10.7167 18 9.55833 17.6333 8.525 16.9C7.49167 16.1667 6.76667 15.2 6.35 14H4.25C4.71667 15.7667 5.66667 17.2083 7.1 18.325C8.53333 19.4417 10.1667 20 12 20Z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
            Reset
          </button>
        </div>
      </div>

      {/* Archived pages */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Archived pages</span>
        <div className={styles.showHideRow}>
          <button className={styles.checkboxRow} onClick={() => setShowArchived(!showArchived)}>
            <div className={styles.checkbox} data-checked={showArchived} />
            <span className={styles.checkboxLabel}>Show archived</span>
          </button>
        </div>
      </div>

      <span className={styles.version}>v{__APP_VERSION__}</span>
    </Modal>
  )
}
