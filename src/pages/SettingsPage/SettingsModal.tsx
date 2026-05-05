import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { useDimensions, useDimensionActions } from '../../hooks/useDimensions'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { usePageActions } from '../../hooks/usePages'
import { useModalContext, usePreferences } from '../../hooks/useAppContext'
import { useBackupSettings, type BackupFrequency } from '../../hooks/useAutoBackup'
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
  const { addDimension, deleteDimension } = useDimensionActions()

  // Dimension add state
  const [addingDim, setAddingDim] = useState(false)
  const [newDimName, setNewDimName] = useState('')

  // Trigger add state
  const [addingTrigger, setAddingTrigger] = useState(false)
  const [newTriggerPageId, setNewTriggerPageId] = useState<number | undefined>()
  const [newTriggerChar, setNewTriggerChar] = useState('')

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
    if (!newTriggerPageId || !newTriggerChar.trim()) return
    const ch = newTriggerChar.trim().slice(0, 1)
    if (ch === '~' || /\s/.test(ch)) return
    await updatePage(newTriggerPageId, { mentionTrigger: ch })
    cancelAddTrigger()
  }

  function cancelAddTrigger() {
    setNewTriggerPageId(undefined)
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
          <button className={styles.iconButton} onClick={() => {
            localStorage.removeItem('onboarding-completed')
            setOnboardingOpen(true)
            onClose()
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8.0752 4.00293C8.08794 4.00388 8.10068 4.00444 8.11328 4.00586C8.13355 4.00816 8.15363 4.01206 8.17383 4.01562C8.18594 4.01775 8.198 4.0199 8.20996 4.02246C8.22828 4.0264 8.24646 4.03112 8.26465 4.03613C8.27901 4.04007 8.29353 4.0433 8.30762 4.04785C8.31983 4.05181 8.33163 4.05707 8.34375 4.06152C8.36414 4.06899 8.38455 4.07622 8.4043 4.08496C8.42019 4.09201 8.43551 4.10045 8.45117 4.1084C8.46157 4.11367 8.47223 4.1184 8.48242 4.12402C8.48954 4.12795 8.49684 4.13162 8.50391 4.13574L20.5039 11.1367L20.5068 11.1387C20.5501 11.164 20.5915 11.1926 20.6309 11.2246C20.6433 11.2347 20.6561 11.2443 20.668 11.2549L20.7451 11.332C20.7554 11.3435 20.7646 11.3561 20.7744 11.3682C20.8046 11.4052 20.8321 11.4439 20.8564 11.4844C20.8588 11.4883 20.8619 11.4921 20.8643 11.4961C20.8903 11.5408 20.9112 11.5871 20.9297 11.6338C20.9334 11.6432 20.937 11.6526 20.9404 11.6621C20.9481 11.6835 20.9548 11.705 20.9609 11.7266C20.9636 11.736 20.9663 11.7454 20.9688 11.7549C20.9735 11.7737 20.9768 11.7926 20.9805 11.8115C20.9832 11.8255 20.9862 11.8394 20.9883 11.8535C20.991 11.8721 20.9934 11.8906 20.9951 11.9092C20.9963 11.9219 20.9974 11.9345 20.998 11.9473C20.999 11.9649 20.999 11.9824 20.999 12C20.999 12.0173 20.9989 12.0345 20.998 12.0518C20.9974 12.0645 20.9963 12.0772 20.9951 12.0898C20.9935 12.1084 20.991 12.1269 20.9883 12.1455C20.9862 12.1596 20.9832 12.1735 20.9805 12.1875C20.9769 12.2064 20.9735 12.2254 20.9688 12.2441C20.9668 12.252 20.9646 12.2597 20.9624 12.2675L20.9609 12.2725C20.9548 12.2941 20.9481 12.3156 20.9404 12.3369L20.9387 12.3417C20.9358 12.3499 20.9329 12.3581 20.9297 12.3662C20.9112 12.4129 20.8903 12.4592 20.8643 12.5039C20.8621 12.5077 20.8587 12.5109 20.8564 12.5146C20.8321 12.5552 20.8046 12.5938 20.7744 12.6309C20.7644 12.6431 20.7556 12.6563 20.7451 12.668L20.668 12.7451C20.6563 12.7556 20.6431 12.7644 20.6309 12.7744C20.5915 12.8064 20.5501 12.8349 20.5068 12.8604L20.5039 12.8633L8.50391 19.8643C8.49698 19.8683 8.48941 19.8711 8.48242 19.875C8.47223 19.8806 8.46158 19.8853 8.45117 19.8906C8.4355 19.8986 8.4202 19.907 8.4043 19.9141C8.38548 19.9224 8.36609 19.9293 8.34668 19.9365C8.33359 19.9414 8.32081 19.9469 8.30762 19.9512C8.29351 19.9557 8.27902 19.959 8.26465 19.9629C8.24644 19.9679 8.2283 19.9726 8.20996 19.9766C8.19799 19.9791 8.18595 19.9813 8.17383 19.9834C8.15362 19.987 8.13356 19.9909 8.11328 19.9932C8.10066 19.9946 8.08795 19.9951 8.0752 19.9961C8.05302 19.9978 8.03093 19.9988 8.00879 19.999C8.00586 19.999 8.00294 20 8 20C7.99215 20 7.98437 19.9982 7.97656 19.998C7.9563 19.9976 7.93616 19.9968 7.91602 19.9951C7.89994 19.9938 7.88401 19.9923 7.86816 19.9902C7.85079 19.9879 7.83362 19.9847 7.81641 19.9814C7.80032 19.9785 7.78436 19.9754 7.76855 19.9717C7.75579 19.9686 7.7431 19.9655 7.73047 19.9619C7.70934 19.956 7.68851 19.9496 7.66797 19.9424L7.66502 19.9413C7.65784 19.9388 7.65067 19.9363 7.64355 19.9336C7.62057 19.9248 7.59831 19.9147 7.57617 19.9043C7.56706 19.9 7.55781 19.8961 7.54883 19.8916C7.53189 19.883 7.51539 19.8738 7.49902 19.8643C7.48612 19.8568 7.47353 19.8489 7.46094 19.8408C7.44807 19.8326 7.4353 19.8243 7.42285 19.8154C7.40618 19.8036 7.39002 19.7912 7.37402 19.7783C7.36716 19.7728 7.36022 19.7674 7.35352 19.7617C7.33616 19.747 7.31916 19.7318 7.30273 19.7158C7.29613 19.7094 7.28962 19.7029 7.2832 19.6963C7.26594 19.6785 7.24945 19.6599 7.2334 19.6406C7.22821 19.6344 7.22282 19.6284 7.21777 19.6221C7.20597 19.6072 7.19464 19.5919 7.18359 19.5762C7.17057 19.5577 7.15827 19.5388 7.14648 19.5195C7.1433 19.5143 7.13982 19.5092 7.13672 19.5039C7.1347 19.5005 7.13283 19.4966 7.13086 19.4932C7.12072 19.4753 7.11159 19.457 7.10254 19.4385C7.09688 19.4269 7.09013 19.416 7.08496 19.4043C7.07664 19.3855 7.06967 19.3661 7.0625 19.3467C7.05765 19.3336 7.05213 19.3208 7.04785 19.3076C7.0433 19.2935 7.04007 19.279 7.03613 19.2646C7.03113 19.2465 7.0264 19.2283 7.02246 19.21C7.0199 19.198 7.01775 19.1859 7.01562 19.1738C7.01206 19.1536 7.00816 19.1335 7.00586 19.1133C7.00444 19.1007 7.00388 19.0879 7.00293 19.0752C7.00184 19.0605 7.00044 19.0459 7 19.0312V4.96875C7.00045 4.95377 7.0018 4.93881 7.00293 4.92383C7.00389 4.91109 7.00443 4.89834 7.00586 4.88574C7.00818 4.86548 7.01204 4.84538 7.01562 4.8252C7.01771 4.8134 7.01997 4.80169 7.02246 4.79004C7.02646 4.77141 7.03102 4.75287 7.03613 4.73438C7.04008 4.72003 7.04329 4.70549 7.04785 4.69141C7.05214 4.67823 7.05764 4.66541 7.0625 4.65234C7.0799 4.60543 7.10008 4.55989 7.12402 4.5166C7.12782 4.50973 7.13177 4.50291 7.13574 4.49609C7.14177 4.48575 7.14893 4.47586 7.15527 4.46582C7.16423 4.45169 7.17299 4.43747 7.18262 4.42383C7.19392 4.40776 7.20569 4.39217 7.21777 4.37695C7.22282 4.37063 7.22821 4.3646 7.2334 4.3584C7.24946 4.33916 7.26594 4.32051 7.2832 4.30273C7.28962 4.29613 7.29613 4.28962 7.30273 4.2832C7.31916 4.26721 7.33617 4.25201 7.35352 4.2373C7.36022 4.23161 7.36717 4.22622 7.37402 4.2207C7.39002 4.20786 7.40618 4.19536 7.42285 4.18359C7.4353 4.17478 7.44808 4.16645 7.46094 4.1582C7.47475 4.14937 7.48874 4.14093 7.50293 4.13281C7.51807 4.12411 7.5332 4.11534 7.54883 4.10742C7.55781 4.10289 7.56707 4.09898 7.57617 4.09473C7.59829 4.08435 7.62059 4.0742 7.64355 4.06543C7.65164 4.06235 7.65981 4.05951 7.66797 4.05664C7.68849 4.04942 7.70936 4.04301 7.73047 4.03711C7.74309 4.03358 7.7558 4.03038 7.76855 4.02734C7.78435 4.0236 7.80033 4.02056 7.81641 4.01758L7.81764 4.01735C7.83443 4.0142 7.85122 4.01106 7.86816 4.00879C7.884 4.0067 7.89996 4.00524 7.91602 4.00391C7.93614 4.00219 7.95632 4.00147 7.97656 4.00098C7.98436 4.0008 7.99216 4 8 4H8.03125C8.0459 4.00044 8.06053 4.00183 8.0752 4.00293Z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
            Show onboarding
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
            <select
              className={styles.inlineInput}
              value={newTriggerPageId ?? ''}
              onChange={(e) => setNewTriggerPageId(e.target.value ? Number(e.target.value) : undefined)}
              style={{ flex: 1 }}
            >
              <option value="">Select a page</option>
              {availableForTrigger.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
            <button className={styles.confirmButton} onClick={handleAddTrigger} aria-label="Confirm"
              style={{ opacity: newTriggerPageId && newTriggerChar.trim() ? 1 : 0.4, pointerEvents: newTriggerPageId && newTriggerChar.trim() ? 'auto' : 'none' }}>{<CheckIcon />}</button>
            <button className={styles.deleteButton} onClick={cancelAddTrigger} aria-label="Cancel">{<TrashIcon />}</button>
          </div>
        )}
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
