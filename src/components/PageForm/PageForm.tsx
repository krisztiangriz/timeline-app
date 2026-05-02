import { useState, useEffect, useRef } from 'react'
import { Modal } from '../Modal/Modal'
import { DragHandleIcon, TrashIcon, CheckIcon, PlusIcon, CloseIcon } from '../Icons/Icons'
import styles from './PageForm.module.css'
import radio from '../../styles/radio.module.css'

export type PageTemplate = 'tabbed' | 'simple' | 'text' | 'custom'

export interface PageFormData {
  name: string
  tabs: string[]
  parentHubId?: number
  template: PageTemplate
  isHub: boolean
}

export interface HubInfo {
  id: number
  name: string
  mentionTrigger?: string
  role?: string
}

interface PageFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: PageFormData) => void
  initial?: Partial<PageFormData>
  isEdit?: boolean
  isHub?: boolean
  hubs?: HubInfo[]
  protectedTabCount?: number
}

function RadioOption({ selected, onChange, label, description, disabled }: {
  selected: boolean; onChange: () => void; label: string; description?: string; disabled?: boolean
}) {
  return (
    <button className={disabled ? styles.radioOptionDisabled : radio.radioOption} onClick={disabled ? undefined : onChange}>
      <div className={radio.radioCircle} data-checked={selected} />
      <span>{label}</span>
      {description && <span className={styles.radioDescription}>{description}</span>}
    </button>
  )
}

function getDefaultTemplate(hub: HubInfo | undefined): PageTemplate {
  if (!hub) return 'custom'
  if (hub.role === 'colleague-hub' || hub.role === 'project-hub') return 'tabbed'
  if (hub.role === 'candidate-hub') return 'text'
  return 'simple'
}

const EMPTY_HUBS: HubInfo[] = []

export function PageForm({ open, onClose, onSubmit, initial, isEdit, isHub: isHubProp, hubs = EMPTY_HUBS, protectedTabCount = 0 }: PageFormProps) {
  const [name, setName] = useState('')
  const [tabs, setTabs] = useState<string[]>([])
  const [addingTab, setAddingTab] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [parentHubId, setParentHubId] = useState<number | undefined>(undefined)
  const [isHubType, setIsHubType] = useState(false)
  const [template, setTemplate] = useState<PageTemplate>('custom')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const prevOpen = useRef(false)

  useEffect(() => {
    if (open && !prevOpen.current) {
      setName(initial?.name ?? '')
      setTabs(initial?.tabs ?? [])
      setAddingTab(false)
      setNewTabName('')
      setParentHubId(initial?.parentHubId)
      setIsHubType(false)
      setTemplate(getDefaultTemplate(hubs.find(h => h.id === initial?.parentHubId)))
      setDragIdx(null)
      setDropIdx(null)
    }
    prevOpen.current = open
  }, [open, initial, hubs])

  // Smart default: update template when hub selection changes
  useEffect(() => {
    if (isHubType || isEdit) return
    const hub = hubs.find(h => h.id === parentHubId)
    setTemplate(getDefaultTemplate(hub))
  }, [parentHubId, isHubType, isEdit, hubs])

  function confirmTab() {
    if (newTabName.trim()) {
      setTabs((t) => [...t, newTabName.trim()])
      setNewTabName('')
    }
  }

  function handleTabDragStart(e: React.DragEvent, idx: number) {
    setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx))
  }
  function handleTabDragOver(e: React.DragEvent, idx: number) {
    if (dragIdx === null || dragIdx === idx) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropIdx(idx)
  }
  function handleTabDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === targetIdx) return
    setTabs((prev) => { const next = [...prev]; const [moved] = next.splice(dragIdx, 1); next.splice(targetIdx, 0, moved); return next })
    setDragIdx(null); setDropIdx(null)
  }
  function handleTabDragEnd() { setDragIdx(null); setDropIdx(null) }

  function handleSubmit() {
    onSubmit({ name, tabs, parentHubId: isHubType ? undefined : parentHubId, template, isHub: isHubType })
  }

  return (
    <Modal
      title={isEdit ? 'Edit page' : 'Add page'}
      open={open}
      onClose={onClose}
      onConfirm={handleSubmit}
      confirmDisabled={!name.trim()}
    >
      {/* Page name */}
      <div className={styles.section}>
        <span className={styles.label}>Page name</span>
        <input className={styles.textInput} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter page name" />
      </div>

      {/* Type — Page or Hub (creation only) */}
      {!isEdit && !isHubProp && (
        <div className={styles.section}>
          <span className={styles.label}>Type</span>
          <div className={styles.radioCol}>
            <RadioOption selected={!isHubType} onChange={() => setIsHubType(false)} label="Page" />
            <RadioOption selected={isHubType} onChange={() => setIsHubType(true)} label="Hub" />
          </div>
        </div>
      )}

      {/* Add to hub (creation only, page type only) */}
      {!isEdit && !isHubProp && !isHubType && hubs.length > 0 && (
        <div className={styles.section}>
          <span className={styles.label}>Add to</span>
          <div className={styles.radioCol}>
            {hubs.map((hub) => (
              <div key={hub.id} className={styles.radioRowItem}>
                <RadioOption
                  selected={parentHubId === hub.id}
                  onChange={() => setParentHubId(hub.id)}
                  label={hub.name}
                />
                {hub.mentionTrigger && <kbd className={styles.triggerBadge}>{hub.mentionTrigger}</kbd>}
              </div>
            ))}
            <RadioOption selected={!parentHubId} onChange={() => setParentHubId(undefined)} label="Do not add to hub" />
          </div>
        </div>
      )}

      {/* Page template (creation only, page type only) */}
      {!isEdit && !isHubProp && !isHubType && (
        <div className={styles.section}>
          <span className={styles.label}>Page template</span>
          <div className={styles.radioCol}>
            <RadioOption selected={template === 'tabbed'} onChange={() => setTemplate('tabbed')} label="Tabbed" description="Timeline, Feedback, Visualization" />
            <RadioOption selected={template === 'simple'} onChange={() => setTemplate('simple')} label="Simple" description="Visualization + Timeline" />
            <RadioOption selected={template === 'text'} onChange={() => setTemplate('text')} label="Text only" description="Notes / Discussion" />
            <RadioOption selected={template === 'custom'} onChange={() => setTemplate('custom')} label="Custom" description="Empty, configure later" />
          </div>
        </div>
      )}

      {/* Tabs (edit mode OR creation with tabbed template) */}
      {(isEdit || (!isEdit && !isHubProp && !isHubType && template === 'tabbed')) && <div className={styles.section}>
        <div className={styles.tabHeader}>
          <span className={styles.label}>Tabs</span>
          {!addingTab && (
            <button className={styles.addButton} onClick={() => setAddingTab(true)} aria-label="Add tab">
              <PlusIcon />
            </button>
          )}
        </div>
        {/* Required tabs (shown as read-only during creation) */}
        {!isEdit && template === 'tabbed' && ['Timeline', 'Feedback', 'Visualization'].map((name) => (
          <div key={name} className={styles.tabRow}>
            <span className={styles.tabRowName}>{name}</span>
            <span className={styles.tabRequired}>Required</span>
          </div>
        ))}
        {tabs.map((tab, i) => {
          const isDragging = dragIdx === i
          const isDropTarget = dropIdx === i
          let cls = styles.tabRow
          if (isDragging) cls += ' ' + styles.tabRowDragging
          if (isDropTarget) cls += ' ' + styles.tabRowDropTarget

          return (
            <div key={`${tab}-${i}`} className={cls}
              draggable
              onDragStart={(e) => handleTabDragStart(e, i)}
              onDragOver={(e) => handleTabDragOver(e, i)}
              onDrop={(e) => handleTabDrop(e, i)}
              onDragEnd={handleTabDragEnd}
            >
              <div className={styles.dragHandle}><DragHandleIcon /></div>
              <span className={styles.tabRowName}>{tab}</span>
              {!(protectedTabCount > 0 && i < protectedTabCount) && (
                <button className={styles.deleteButton} onClick={() => setTabs((t) => t.filter((_, j) => j !== i))} aria-label={`Delete ${tab}`}>
                  <TrashIcon />
                </button>
              )}
            </div>
          )
        })}
        {addingTab && (
          <div className={styles.tabRow}>
            <input className={styles.textInput} style={{ flex: 1, height: 32 }} type="text" value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmTab() }
                if (e.key === 'Escape') { setAddingTab(false); setNewTabName('') }
              }}
              placeholder="Tab name" autoFocus />
            <button className={styles.tabInputAction} onClick={confirmTab} aria-label="Confirm tab" style={{ opacity: newTabName.trim() ? 1 : 0.4, pointerEvents: newTabName.trim() ? 'auto' : 'none' }}>
              <CheckIcon />
            </button>
            <button className={styles.tabInputAction} onClick={() => { setAddingTab(false); setNewTabName('') }} aria-label="Cancel">
              <CloseIcon />
            </button>
          </div>
        )}
      </div>}
    </Modal>
  )
}
