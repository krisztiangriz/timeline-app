import { useState } from 'react'
import { useRadioGroupKeyboard } from '../../hooks/useRadioGroupKeyboard'
import { Modal } from '../../components/Modal/Modal'
import { useModalContext, usePreferences } from '../../hooks/useAppContext'
import { useBackupSettings, type BackupFrequency } from '../../hooks/useAutoBackup'
import { useOnboardingActions } from '../../hooks/useOnboardingGuides'
import { onboardingGuides } from '../../config/onboardingGuides'
import { TrashIcon, CheckIcon, PlusIcon, ResetIcon } from '../../components/Icons/Icons'
import { downloadJson, triggerImport } from '../../utils/exportImport'
import { useEntryTags, addEntryTag, updateEntryTag, deleteEntryTag } from '../../hooks/useEntryTags'
import { useTheme, type Theme } from '../../hooks/useTheme'
import { safeRemoveItem } from '../../utils/safeStorage'
import styles from './SettingsModal.module.css'

const THEME_OPTIONS: Theme[] = ['light', 'dark']
const BACKUP_OPTIONS: BackupFrequency[] = ['daily', 'weekly', 'monthly', 'off']

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onToast: (msg: string) => void
}

export function SettingsModal({ open, onClose, onToast }: SettingsModalProps) {
  const { showArchived, setShowArchived } = usePreferences()
  const { setOnboardingOpen } = useModalContext()
  const { frequency, setFrequency, lastBackup } = useBackupSettings()
  const { resetAllGuides, isGuideDismissed } = useOnboardingActions()
  const entryTags = useEntryTags()
  const { theme, setTheme } = useTheme()
  const { groupRef: themeGroupRef, handleKeyDown: themeKeyDown } = useRadioGroupKeyboard(THEME_OPTIONS, theme, setTheme)
  const { groupRef: backupGroupRef, handleKeyDown: backupKeyDown } = useRadioGroupKeyboard(BACKUP_OPTIONS, frequency, setFrequency)

  // Entry tag state
  const [addingTag, setAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagSlug, setNewTagSlug] = useState('')
  const [newTagCategory, setNewTagCategory] = useState('')
  const [renamingTagId, setRenamingTagId] = useState<number | null>(null)
  const [renamingTagName, setRenamingTagName] = useState('')

  async function handleAddTag() {
    if (!newTagName.trim() || !newTagSlug.trim() || !newTagCategory.trim()) return
    try {
      await addEntryTag(newTagName.trim(), newTagSlug.trim(), newTagCategory.trim())
      setNewTagName('')
      setNewTagSlug('')
      setNewTagCategory('')
      setAddingTag(false)
    } catch { onToast('Failed to add tag') }
  }

  async function handleRenameTag(id: number) {
    if (!renamingTagName.trim()) { setRenamingTagId(null); return }
    try {
      await updateEntryTag(id, { name: renamingTagName.trim() })
      setRenamingTagId(null)
      setRenamingTagName('')
    } catch { onToast('Failed to rename tag') }
  }


  async function handleExport() {
    await downloadJson('timeline-export')
    onToast('Data exported')
  }

  async function handleImport() {
    try {
      await triggerImport()
      window.location.reload()
    } catch {
      onToast('Import failed')
    }
  }

  return (
    <Modal title="Settings" open={open} onClose={onClose} onConfirm={onClose}>
      {/* Theme */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Theme</span>
        <div ref={themeGroupRef} className={styles.backupRow} role="radiogroup" aria-label="Theme" onKeyDown={themeKeyDown}>
          {THEME_OPTIONS.map((opt) => (
            <button key={opt} className={styles.checkboxRow} onClick={() => setTheme(opt)} role="radio" aria-checked={theme === opt} tabIndex={theme === opt ? 0 : -1}>
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
          Export or Import all your data as JSON. Import replaces all existing data.
        </span>
        <div className={styles.buttonRow}>
          <button className={styles.iconButton} onClick={handleExport} tabIndex={0}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M8.25 1.5V8.691L5.781 6.219L4.719 7.281L9 11.559L13.281 7.281L12.219 6.219L9.75 8.691V1.5H8.25ZM1.5 12.75V15C1.5 15.82 2.18 16.5 3 16.5H15C15.82 16.5 16.5 15.82 16.5 15V12.75H15V15H3V12.75H1.5Z" fill="currentColor" />
            </svg>
            Export
          </button>
          <button className={styles.iconButton} onClick={handleImport} tabIndex={0}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M8.25 12V5.559L5.781 8.031L4.719 6.969L9 2.691L13.281 6.969L12.219 8.031L9.75 5.559V12H8.25ZM1.5 12.75V15C1.5 15.82 2.18 16.5 3 16.5H15C15.82 16.5 16.5 15.82 16.5 15V12.75H15V15H3V12.75H1.5Z" fill="currentColor" />
            </svg>
            Import
          </button>
        </div>
      </div>

      {/* Auto-Backup */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Auto-Backup</span>
        <div ref={backupGroupRef} className={styles.backupRow} role="radiogroup" aria-label="Auto-backup frequency" onKeyDown={backupKeyDown}>
          {BACKUP_OPTIONS.map((opt) => (
            <button key={opt} className={styles.checkboxRow} onClick={() => setFrequency(opt)} role="radio" aria-checked={frequency === opt} tabIndex={frequency === opt ? 0 : -1}>
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

      {/* Entry Tags */}
      <div className={styles.section}>
        <div className={styles.listHeader}>
          <span className={styles.sectionTitle}>Entry Tags</span>
          <button className={styles.iconButton} onClick={() => setAddingTag(true)} aria-label="Add entry tag" tabIndex={0}>
            <PlusIcon size={14} />
            Add
          </button>
        </div>
        <span className={styles.sectionDescription}>
          Tags classify timeline entries (type ! in the editor). Each tag maps to a chart category.
        </span>
        <div className={styles.patternList}>
          {entryTags.map((tag) => (
            <div key={tag.id} className={styles.patternRow}>
              {renamingTagId === tag.id ? (
                <>
                  <input
                    className={styles.patternInlineInput}
                    type="text"
                    value={renamingTagName}
                    onChange={(e) => setRenamingTagName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameTag(tag.id!); if (e.key === 'Escape') setRenamingTagId(null) }}
                    autoFocus
                  />
                  <button className={styles.confirmButton} onClick={() => handleRenameTag(tag.id!)} tabIndex={0}><CheckIcon /></button>
                </>
              ) : (
                <span
                  className={styles.patternName}
                  onClick={() => { setRenamingTagId(tag.id!); setRenamingTagName(tag.name) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRenamingTagId(tag.id!); setRenamingTagName(tag.name) } }}
                  role="button"
                  tabIndex={0}
                >
                  !{tag.slug}
                </span>
              )}
              <span className={styles.patternLabel}>{tag.category}</span>
              <button className={styles.deleteButton} onClick={() => deleteEntryTag(tag.id!).catch(() => onToast('Failed to delete tag'))} aria-label={`Delete ${tag.name}`} tabIndex={0}>
                <TrashIcon />
              </button>
            </div>
          ))}
          {addingTag && (
            <div className={styles.patternRow}>
              <input
                className={styles.patternInlineInput}
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newTagName.trim()) { ((e.target as HTMLElement).nextElementSibling as HTMLInputElement)?.focus() } if (e.key === 'Escape') { setAddingTag(false); setNewTagName(''); setNewTagSlug(''); setNewTagCategory('') } }}
                placeholder="Display Name"
                autoFocus
              />
              <input
                className={styles.patternInlineInput}
                type="text"
                value={newTagSlug}
                onChange={(e) => setNewTagSlug(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newTagSlug.trim()) { ((e.target as HTMLElement).nextElementSibling as HTMLInputElement)?.focus() } if (e.key === 'Escape') { setAddingTag(false); setNewTagName(''); setNewTagSlug(''); setNewTagCategory('') } }}
                placeholder="Trigger"
              />
              <input
                className={styles.patternInlineInput}
                type="text"
                value={newTagCategory}
                onChange={(e) => setNewTagCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setAddingTag(false); setNewTagName(''); setNewTagSlug(''); setNewTagCategory('') } }}
                placeholder="Chart Label"
              />
              <button className={styles.confirmButton} onClick={handleAddTag} tabIndex={0}
                style={{ opacity: newTagName.trim() && newTagSlug.trim() && newTagCategory.trim() ? 1 : 0.4 }}><CheckIcon /></button>
              <button className={styles.deleteButton} onClick={() => { setAddingTag(false); setNewTagName(''); setNewTagSlug(''); setNewTagCategory('') }} aria-label="Cancel" tabIndex={0}>
                <TrashIcon />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding */}
      <div className={styles.section}>
        <div className={styles.listHeader}>
          <span className={styles.sectionTitle}>Onboarding</span>
          <button className={styles.iconButton} tabIndex={0} onClick={() => {
            safeRemoveItem('onboarding-completed')
            safeRemoveItem('user-created-page')
            resetAllGuides()
            setOnboardingOpen(true)
            onClose()
          }}>
            <ResetIcon />
            Reset
          </button>
        </div>
        <span className={styles.backupStatus}>Status: {onboardingGuides.filter((g) => isGuideDismissed(g.id)).length}/{onboardingGuides.length}</span>
      </div>

      {/* Archived pages */}
      <div className={styles.section}>
        <div className={styles.listHeader}>
          <span className={styles.sectionTitle}>Archived Pages</span>
          <button className={styles.checkboxRow} onClick={() => setShowArchived(!showArchived)} role="checkbox" aria-checked={showArchived} tabIndex={0}>
            <div className={styles.checkbox} data-checked={showArchived} />
            <span className={styles.checkboxLabel}>Show archived</span>
          </button>
        </div>
      </div>

      <span className={styles.version}>Release {__APP_VERSION__}</span>
    </Modal>
  )
}
