import { useState, useEffect, useRef } from 'react'
import { Modal } from '../Modal/Modal'
import { DragHandleIcon, TrashIcon, CheckIcon, PlusIcon, CloseIcon } from '../Icons/Icons'
import type { BlockType } from '../../types'
import styles from './PageForm.module.css'
import radio from '../../styles/radio.module.css'

export type PageTemplate = 'tabbed' | 'simple' | 'text' | 'custom' | 'hub-standard' | 'hub-table'

export interface BlockItem {
  id: number
  type: BlockType
  tabId?: number
  order: number
}

export interface PageFormData {
  name: string
  tabs: string[]
  parentHubId?: number
  template: PageTemplate
  isHub: boolean
  mentionTrigger?: string
  mentionCollapsed?: boolean
  inheritedTrigger?: string
  inheritedFrom?: string
  blocks?: BlockItem[]
  blockOrder?: BlockItem[]
  deletedBlockIds?: number[]
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

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: 'Text',
  timeline: 'Timeline',
  feedback: 'Feedback',
  table: 'Table',
  visualization: 'Visualization',
}

function BlockListEditor({ blocks, tabs, onReorder, onDelete, dragIdx, dropIdx, onDragStart, onDragEnd, onDragOver }: {
  blocks: BlockItem[]
  tabs: string[]
  onReorder: (blocks: BlockItem[]) => void
  onDelete: (id: number) => void
  dragIdx: { group: string; idx: number } | null
  dropIdx: { group: string; idx: number } | null
  onDragStart: (v: { group: string; idx: number }) => void
  onDragEnd: () => void
  onDragOver: (v: { group: string; idx: number }) => void
}) {
  // Group blocks: page-level first, then by tab
  const pageLevel = blocks.filter((b) => !b.tabId).sort((a, b) => a.order - b.order)
  const tabGroups: { key: string; label: string; items: BlockItem[] }[] = []

  // Build tab groups from the tabs array (matching by index since we don't have tab IDs in the form)
  const tabIdSet = new Set(blocks.filter((b) => b.tabId).map((b) => b.tabId!))
  const tabIds = [...tabIdSet].sort((a, b) => {
    const aOrder = blocks.find((bl) => bl.tabId === a)?.order ?? 0
    const bOrder = blocks.find((bl) => bl.tabId === b)?.order ?? 0
    return aOrder - bOrder
  })

  for (const tabId of tabIds) {
    const items = blocks.filter((b) => b.tabId === tabId).sort((a, b) => a.order - b.order)
    // Try to match tab name from tabs array by position or find a label
    const tabIndex = tabIds.indexOf(tabId)
    const label = tabs[tabIndex] ?? `Tab ${tabIndex + 1}`
    tabGroups.push({ key: String(tabId), label, items })
  }

  function handleDrop(group: string, targetIdx: number) {
    if (!dragIdx || dragIdx.group !== group) return
    const sourceIdx = dragIdx.idx

    // Get the items for this group
    const isPageLevel = group === 'page'
    const groupItems = isPageLevel ? [...pageLevel] : [...(tabGroups.find((g) => g.key === group)?.items ?? [])]

    const [moved] = groupItems.splice(sourceIdx, 1)
    groupItems.splice(targetIdx, 0, moved)

    // Rebuild full block list with updated orders
    const updated = blocks.map((b) => {
      const inGroup = isPageLevel ? !b.tabId : b.tabId === Number(group)
      if (!inGroup) return b
      const newIdx = groupItems.findIndex((g) => g.id === b.id)
      return newIdx >= 0 ? { ...b, order: newIdx } : b
    })
    onReorder(updated)
    onDragEnd()
  }

  function renderGroup(groupKey: string, items: BlockItem[]) {
    return items.map((block, idx) => {
      const isDragging = dragIdx?.group === groupKey && dragIdx.idx === idx
      const isOver = dropIdx?.group === groupKey && dropIdx.idx === idx
      let cls = styles.blockRow
      if (isDragging) cls += ' ' + styles.blockRowDragging
      if (isOver) cls += ' ' + styles.blockRowDropTarget

      return (
        <div key={block.id} className={cls}
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart({ group: groupKey, idx }) }}
          onDragOver={(e) => { e.preventDefault(); onDragOver({ group: groupKey, idx }) }}
          onDrop={(e) => { e.preventDefault(); handleDrop(groupKey, idx) }}
          onDragEnd={onDragEnd}
        >
          <div className={styles.dragHandle}><DragHandleIcon /></div>
          <span className={styles.blockRowLabel}>{BLOCK_TYPE_LABELS[block.type]}</span>
          <button className={styles.deleteButton} onClick={() => onDelete(block.id)} aria-label={`Delete ${BLOCK_TYPE_LABELS[block.type]} block`}>
            <TrashIcon />
          </button>
        </div>
      )
    })
  }

  return (
    <div className={styles.blockListEditor}>
      {pageLevel.length > 0 && renderGroup('page', pageLevel)}
      {tabGroups.map((group) => (
        <div key={group.key}>
          <span className={styles.blockGroupTitle}>{group.label}</span>
          {renderGroup(group.key, group.items)}
        </div>
      ))}
    </div>
  )
}

export function PageForm({ open, onClose, onSubmit, initial, isEdit, isHub: isHubProp, hubs = EMPTY_HUBS, protectedTabCount = 0 }: PageFormProps) {
  const [name, setName] = useState('')
  const [tabs, setTabs] = useState<string[]>([])
  const [addingTab, setAddingTab] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [parentHubId, setParentHubId] = useState<number | undefined>(undefined)
  const [isHubType, setIsHubType] = useState(false)
  const [template, setTemplate] = useState<PageTemplate>('custom')
  const [trigger, setTrigger] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [blockList, setBlockList] = useState<BlockItem[]>([])
  const [deletedBlockIds, setDeletedBlockIds] = useState<number[]>([])
  const [blockDragIdx, setBlockDragIdx] = useState<{ group: string; idx: number } | null>(null)
  const [blockDropIdx, setBlockDropIdx] = useState<{ group: string; idx: number } | null>(null)
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
      setTrigger(initial?.mentionTrigger ?? '')
      setCollapsed(initial?.mentionCollapsed ?? false)
      setBlockList(initial?.blocks ?? [])
      setDeletedBlockIds([])
      setBlockDragIdx(null)
      setBlockDropIdx(null)
      setDragIdx(null)
      setDropIdx(null)
    }
    prevOpen.current = open
  }, [open, initial, hubs])

  // Smart default: update template when hub selection or type changes
  useEffect(() => {
    if (isEdit) return
    if (isHubType) { setTemplate('hub-standard'); return }
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
    onSubmit({
      name, tabs, parentHubId: isHubType ? undefined : parentHubId, template, isHub: isHubType,
      mentionTrigger: trigger || undefined, mentionCollapsed: collapsed || undefined,
      blockOrder: blockList.length > 0 ? blockList : undefined,
      deletedBlockIds: deletedBlockIds.length > 0 ? deletedBlockIds : undefined,
    })
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

      {/* Hub template (creation only, hub type only) */}
      {!isEdit && !isHubProp && isHubType && (
        <div className={styles.section}>
          <span className={styles.label}>Hub template</span>
          <div className={styles.radioCol}>
            <RadioOption selected={template === 'hub-standard'} onChange={() => setTemplate('hub-standard')} label="Standard" description="Visualization + Table" />
            <RadioOption selected={template === 'hub-table'} onChange={() => setTemplate('hub-table')} label="Table" description="Table only" />
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

      {/* Trigger character (optional — for hubs and standalone root pages; read-only for child pages) */}
      {(isHubType || isHubProp || (!isEdit && !parentHubId) || (isEdit && (trigger || initial?.inheritedTrigger))) && (
        <div className={styles.section}>
          <span className={styles.label}>Trigger{initial?.inheritedTrigger ? '' : ' (optional)'}</span>
          {initial?.inheritedTrigger ? (
            <>
              <div className={styles.triggerRow}>
                <input
                  className={styles.textInput}
                  type="text"
                  value={initial.inheritedTrigger}
                  disabled
                  style={{ width: 52, fontFamily: 'ui-monospace, monospace', opacity: 0.5 }}
                />
                <span className={styles.radioDescription}>Inherited from {initial.inheritedFrom}</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.triggerRow}>
                <input
                  className={styles.textInput}
                  type="text"
                  value={trigger}
                  onChange={(e) => {
                    const ch = e.target.value.slice(0, 1)
                    if (ch === '~' || /\s/.test(ch)) return
                    setTrigger(ch)
                  }}
                  placeholder="e.g. # @ !"
                  style={{ width: 52, fontFamily: 'ui-monospace, monospace' }}
                />
                {trigger && (
                  <button className={styles.labelToggle} onClick={() => setCollapsed(!collapsed)} type="button">
                    <div className={styles.labelCheckbox} data-checked={!collapsed} />
                    <span className={styles.labelText}>Label</span>
                  </button>
                )}
                {!trigger && <span className={styles.radioDescription}>Use single special character</span>}
              </div>
            </>
          )}
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
        {isEdit && tabs.length === 0 && !addingTab && (
          <span className={styles.emptyHint}>Add tabs to organize page content</span>
        )}
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

      {/* Blocks (edit mode only) */}
      {isEdit && blockList.length > 0 && (
        <div className={styles.section}>
          <span className={styles.label}>Blocks</span>
          <BlockListEditor
            blocks={blockList}
            tabs={tabs}
            onReorder={setBlockList}
            onDelete={(id) => { setBlockList((b) => b.filter((x) => x.id !== id)); setDeletedBlockIds((d) => [...d, id]) }}
            dragIdx={blockDragIdx}
            dropIdx={blockDropIdx}
            onDragStart={setBlockDragIdx}
            onDragEnd={() => { setBlockDragIdx(null); setBlockDropIdx(null) }}
            onDragOver={setBlockDropIdx}
          />
        </div>
      )}
    </Modal>
  )
}
