import { useState, useEffect, useRef, useCallback } from 'react'
import { Modal } from '../Modal/Modal'
import { PropertyEditorContent } from '../PropertyEditor/PropertyEditor'
import { DragHandleIcon, TrashIcon, CheckIcon, PlusIcon, CloseIcon } from '../Icons/Icons'
import { db } from '../../db/database'
import type { BlockType } from '../../types'
import styles from './PageForm.module.css'
import radio from '../../styles/radio.module.css'

export type PageTemplate = 'tabbed' | 'simple' | 'text' | 'custom' | 'hub-standard'

export interface BlockItem {
  id: number
  type: BlockType
  tabId?: number
}

export interface PageFormData {
  name: string
  tabs: string[]
  parentHubId?: number
  template: PageTemplate
  isHub: boolean
  existingPageId?: number  // for hub creation: hub already exists in DB
  mentionTrigger?: string
  mentionCollapsed?: boolean
  inheritedTrigger?: string
  inheritedFrom?: string
  blocks?: BlockItem[]
  tabInfo?: { id: number; name: string }[]
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
  onSubmit: (data: PageFormData) => unknown
  initial?: Partial<PageFormData>
  isEdit?: boolean
  isHub?: boolean
  hubs?: HubInfo[]
  protectedTabCount?: number
  hubId?: number  // when editing a hub, enables step 2 (property config)
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

function BlockListEditor({ blocks, tabInfo, onReorder, onDelete, onDeleteTab, protectedTabCount, dragIdx, dropIdx, onDragStart, onDragEnd, onDragOver }: {
  blocks: BlockItem[]
  tabInfo: { id: number; name: string }[]
  onReorder: (blocks: BlockItem[]) => void
  onDelete: (id: number) => void
  onDeleteTab?: (index: number) => void
  protectedTabCount: number
  dragIdx: { group: string; idx: number } | null
  dropIdx: { group: string; idx: number } | null
  onDragStart: (v: { group: string; idx: number }) => void
  onDragEnd: () => void
  onDragOver: (v: { group: string; idx: number }) => void
}) {
  // Page-level blocks (no tabId)
  const pageLevel = blocks.filter((b) => !b.tabId)

  // Build tab groups from tabInfo — every tab always renders (even with 0 blocks)
  const tabGroups = tabInfo.map((tab) => ({
    key: String(tab.id),
    label: tab.name,
    items: blocks.filter((b) => b.tabId === tab.id),
  }))

  function handleDrop(group: string, targetIdx: number) {
    if (!dragIdx) return
    const sourceGroup = dragIdx.group
    const sourceIdx = dragIdx.idx

    // Determine the target tabId for the destination group
    const targetTabId = group === 'page' ? undefined : Number(group)

    if (sourceGroup === group) {
      // Same-group reorder
      const isPageLevel = group === 'page'
      const groupItems = isPageLevel ? [...pageLevel] : [...(tabGroups.find((g) => g.key === group)?.items ?? [])]
      const [moved] = groupItems.splice(sourceIdx, 1)
      groupItems.splice(targetIdx, 0, moved)

      // Rebuild block list preserving new order
      const otherBlocks = blocks.filter((b) => isPageLevel ? !!b.tabId : b.tabId !== Number(group))
      onReorder([...otherBlocks, ...groupItems])
    } else {
      // Cross-group move: change the block's tabId and reorder both groups
      const sourceIsPage = sourceGroup === 'page'
      const sourceItems = sourceIsPage ? [...pageLevel] : [...(tabGroups.find((g) => g.key === sourceGroup)?.items ?? [])]
      const targetIsPage = group === 'page'
      const targetItems = targetIsPage ? [...pageLevel] : [...(tabGroups.find((g) => g.key === group)?.items ?? [])]

      const [moved] = sourceItems.splice(sourceIdx, 1)
      const movedWithNewTab = { ...moved, tabId: targetTabId }
      targetItems.splice(targetIdx, 0, movedWithNewTab)

      // Rebuild full block list: keep blocks not in source or target groups, then append reordered groups
      const updated = blocks.filter((b) => {
        if (b.id === moved.id) return false
        if (sourceIsPage ? !b.tabId : b.tabId === Number(sourceGroup)) return false
        if (targetIsPage ? !b.tabId : b.tabId === Number(group)) return false
        return true
      })
      onReorder([...updated, ...sourceItems, ...targetItems])
    }
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
      {renderGroup('page', pageLevel)}
      {tabGroups.map((group, groupIdx) => (
        <div key={group.key}>
          <div
            className={styles.blockGroupHeader}
            onDragOver={(e) => { e.preventDefault(); onDragOver({ group: group.key, idx: 0 }) }}
            onDrop={(e) => { e.preventDefault(); handleDrop(group.key, 0) }}
          >
            <span className={styles.blockGroupTitle}>{group.label}</span>
            {onDeleteTab && !(protectedTabCount > 0 && groupIdx < protectedTabCount) && (
              <button className={styles.deleteButton} onClick={() => onDeleteTab(groupIdx)} aria-label={`Delete tab ${group.label}`}>
                <TrashIcon />
              </button>
            )}
          </div>
          {renderGroup(group.key, group.items)}
        </div>
      ))}
    </div>
  )
}

export function PageForm({ open, onClose, onSubmit, initial, isEdit, isHub: isHubProp, hubs = EMPTY_HUBS, protectedTabCount = 0, hubId }: PageFormProps) {
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
  const blocksModified = useRef(false)
  const [blockDragIdx, setBlockDragIdx] = useState<{ group: string; idx: number } | null>(null)
  const [blockDropIdx, setBlockDropIdx] = useState<{ group: string; idx: number } | null>(null)
  const prevOpen = useRef(false)
  const [createdHubId, setCreatedHubId] = useState<number | null>(null)
  const hubConfirmed = useRef(false)

  // Creating a new hub — properties appear immediately when Hub type is selected
  const isCreatingHub = !isEdit && isHubType

  // Create placeholder hub immediately when user selects Hub type
  useEffect(() => {
    if (!open || isEdit) return
    if (isHubType && !createdHubId) {
      ;(async () => {
        const id = await db.pages.add({
          name: name.trim() || 'Untitled',
          type: 'hub' as const,
          description: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          editCount: 0,
        })
        setCreatedHubId(id as number)
      })()
    }
  }, [isHubType, open, isEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup: delete placeholder hub if user switches back to Page type
  useEffect(() => {
    if (!open || isEdit) return
    if (!isHubType && createdHubId && !hubConfirmed.current) {
      db.pages.delete(createdHubId)
      setCreatedHubId(null)
    }
  }, [isHubType, open, isEdit, createdHubId])

  // Cleanup function for cancel/close
  const cleanupPlaceholderHub = useCallback(async () => {
    if (createdHubId && !hubConfirmed.current) {
      // Delete the placeholder hub and any properties/blocks created on it
      await db.transaction('rw', [db.pages, db.blocks, db.hubProperties, db.pagePropertyValues], async () => {
        await db.hubProperties.where('hubId').equals(createdHubId).delete()
        await db.blocks.where('pageId').equals(createdHubId).delete()
        await db.pages.delete(createdHubId)
      })
      setCreatedHubId(null)
    }
  }, [createdHubId])

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
      blocksModified.current = false
      setBlockDragIdx(null)
      setBlockDropIdx(null)
      setCreatedHubId(null)
      hubConfirmed.current = false
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
      setAddingTab(false)
    }
  }

  async function handleConfirm() {
    // Hub creation: hub already exists as placeholder, finalize it
    if (isCreatingHub && createdHubId) {
      try {
        hubConfirmed.current = true
        // Update the hub with final name/trigger
        await db.pages.update(createdHubId, {
          name: name.trim() || 'Untitled',
          mentionTrigger: trigger || undefined,
          mentionCollapsed: collapsed || undefined,
          updatedAt: new Date(),
        })
        // Add default blocks (visualization + table)
        const existingBlocks = await db.blocks.where('pageId').equals(createdHubId).count()
        if (existingBlocks === 0) {
          await db.blocks.add({ pageId: createdHubId, type: 'visualization' })
          await db.blocks.add({ pageId: createdHubId, type: 'table' })
        }
        // Notify parent (for navigation/toast)
        onSubmit({
          name, tabs, parentHubId: undefined, template, isHub: true,
          existingPageId: createdHubId,
          mentionTrigger: trigger || undefined, mentionCollapsed: collapsed || undefined,
        })
      } catch {
        hubConfirmed.current = false
      }
      return
    }

    // Normal submit (edit mode or non-hub creation)
    onSubmit({
      name, tabs, parentHubId: isHubType ? undefined : parentHubId, template, isHub: isHubType,
      mentionTrigger: trigger || undefined, mentionCollapsed: collapsed || undefined,
      blocks: blocksModified.current ? blockList : undefined,
      deletedBlockIds: deletedBlockIds.length > 0 ? deletedBlockIds : undefined,
    })
  }

  // Effective hubId for property editor (either from prop or from just-created hub)
  const effectiveHubId = hubId ?? createdHubId ?? undefined

  return (
    <Modal
      title={isEdit ? 'Edit page' : 'Add page'}
      open={open}
      onClose={() => { cleanupPlaceholderHub(); onClose() }}
      onConfirm={handleConfirm}
      confirmDisabled={!name.trim()}
    >
      {/* Page name */}
      <div className={styles.section}>
        <span className={styles.label}>Page name</span>
        <input className={styles.textInput} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter page name" />
      </div>

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

      {/* Template (creation only — page type) */}
      {!isEdit && !isHubProp && !isHubType && (
        <div className={styles.section}>
          <span className={styles.label}>Template</span>
          <div className={styles.radioCol}>
            <RadioOption selected={template === 'tabbed'} onChange={() => setTemplate('tabbed')} label="Tabbed" description="Timeline, Feedback, Visualization" />
            <RadioOption selected={template === 'simple'} onChange={() => setTemplate('simple')} label="Simple" description="Visualization + Timeline" />
            <RadioOption selected={template === 'text'} onChange={() => setTemplate('text')} label="Text only" description="Notes / Discussion" />
            <RadioOption selected={template === 'custom'} onChange={() => setTemplate('custom')} label="Custom" description="Empty, configure later" />
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

      {/* Layout: Tabs & Blocks (edit mode OR creation with tabbed template) */}
      {(isEdit || (!isEdit && !isHubProp && !isHubType && template === 'tabbed')) && <div className={styles.section}>
        <div className={styles.tabHeader}>
          <span className={styles.label}>Layout</span>
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
        {isEdit && tabs.length === 0 && blockList.length === 0 && !addingTab && (
          <span className={styles.emptyHint}>Add tabs to organize page content</span>
        )}
        {/* Blocks & Tabs unified layout */}
        {isEdit && (blockList.length > 0 || (initial?.tabInfo ?? []).length > 0) && (
          <BlockListEditor
            blocks={blockList}
            tabInfo={initial?.tabInfo ?? []}
            onReorder={(b) => { blocksModified.current = true; setBlockList(b) }}
            onDelete={(id) => { blocksModified.current = true; setBlockList((b) => b.filter((x) => x.id !== id)); setDeletedBlockIds((d) => [...d, id]) }}
            onDeleteTab={(i) => setTabs((t) => t.filter((_, j) => j !== i))}
            protectedTabCount={protectedTabCount}
            dragIdx={blockDragIdx}
            dropIdx={blockDropIdx}
            onDragStart={setBlockDragIdx}
            onDragEnd={() => { setBlockDragIdx(null); setBlockDropIdx(null) }}
            onDragOver={setBlockDropIdx}
          />
        )}
        {/* Newly added tabs (not yet in DB — shown as simple rows) */}
        {(() => {
          const existingTabCount = initial?.tabInfo?.length ?? 0
          const newTabs = isEdit ? tabs.slice(existingTabCount) : tabs
          return newTabs.map((tab, i) => {
            const actualIdx = existingTabCount + i
            return (
              <div key={`new-${tab}-${i}`} className={styles.tabRow}>
                <span className={styles.tabRowName}>{tab}</span>
                <button className={styles.deleteButton} onClick={() => setTabs((t) => t.filter((_, j) => j !== actualIdx))} aria-label={`Delete ${tab}`}>
                  <TrashIcon />
                </button>
              </div>
            )
          })
        })()}
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

      {/* Properties section (hub edit mode, or after hub creation) */}
      {effectiveHubId && (
        <PropertyEditorContent hubId={effectiveHubId} />
      )}
    </Modal>
  )
}
