import { useState } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { useDimensions, useDimensionActions } from '../../hooks/useDimensions'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { usePageActions } from '../../hooks/usePages'
import { useAppContext } from '../../hooks/useAppContext'
import { TrashIcon, CheckIcon, PlusIcon } from '../../components/Icons/Icons'
import { downloadExport, triggerImport } from '../../utils/exportImport'
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
  const { showArchived, setShowArchived } = useAppContext()
  const { addDimension, deleteDimension } = useDimensionActions()

  // Dimension add state
  const [addingDim, setAddingDim] = useState(false)
  const [newDimName, setNewDimName] = useState('')

  // Hub pages (for trigger editing)
  // Pages with triggers (hubs + any page with a mentionTrigger)
  const triggerPages = allPages.filter((p) => p.type === 'hub' || p.mentionTrigger)

  async function handleTriggerChange(pageId: number, value: string) {
    const ch = value.slice(0, 1)
    if (ch === '~' || /\s/.test(ch)) return
    const mentionTrigger = ch === '' ? undefined : ch
    await updatePage(pageId, { mentionTrigger })
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

  return (
    <Modal title="Settings" open={open} onClose={onClose} onConfirm={onClose}>
      {/* Data */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Data</span>
        <span className={styles.sectionDescription}>
          Export or Import all your data as JSON. Importing will replace all existing data.
        </span>
        <div className={styles.buttonRow}>
          <button className={styles.iconButton} onClick={handleExport}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M8.25 1.5V8.691L5.781 6.219L4.719 7.281L9 11.559L13.281 7.281L12.219 6.219L9.75 8.691V1.5H8.25ZM1.5 12.75V15C1.5 15.82 2.18 16.5 3 16.5H15C15.82 16.5 16.5 15.82 16.5 15V12.75H15V15H3V12.75H1.5Z" fill="currentColor" />
            </svg>
            Export JSON
          </button>
          <button className={styles.iconButton} onClick={handleImport}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M8.25 12V5.559L5.781 8.031L4.719 6.969L9 2.691L13.281 6.969L12.219 8.031L9.75 5.559V12H8.25ZM1.5 12.75V15C1.5 15.82 2.18 16.5 3 16.5H15C15.82 16.5 16.5 15.82 16.5 15V12.75H15V15H3V12.75H1.5Z" fill="currentColor" />
            </svg>
            Import JSON
          </button>
        </div>
      </div>

      {/* Show archived */}
      <div className={styles.section}>
        <button className={styles.checkboxRow} onClick={() => setShowArchived(!showArchived)}>
          <div className={styles.checkbox} data-checked={showArchived} />
          <span className={styles.sectionTitle}>Show archived</span>
        </button>
      </div>

      {/* Triggers */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Triggers</span>
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
          </div>
        ))}
      </div>

      {/* Dimensions */}
      <div className={styles.section}>
        <div className={styles.listHeader}>
          <span className={styles.sectionTitle}>Feedback dimensions</span>
          <button className={styles.addButton} onClick={() => setAddingDim(true)} aria-label="Add dimension">{<PlusIcon />}</button>
        </div>
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
