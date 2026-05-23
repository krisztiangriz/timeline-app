import { useState, useEffect, useRef, useCallback } from 'react'
import { Modal } from '../Modal/Modal'
import { PropertyEditorContent } from '../PropertyEditor/PropertyEditor'
import { DragHandleIcon, TrashIcon, CheckIcon, PlusIcon, CloseIcon } from '../Icons/Icons'
import { db } from '../../db/database'
import type { BlockType } from '../../types'
import styles from './PageForm.module.css'
import radio from '../../styles/radio.module.css'

export type PageTemplate = 'tabbed' | 'empty'

export interface BlockItem {
  id: number
  type: BlockType
  tabId?: number
}

export interface PageFormData {
  name: string
  tabs: { name: string; type: BlockType }[]
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
  if (!hub) return 'empty'
  if (hub.role === 'colleague-hub' || hub.role === 'project-hub') return 'tabbed'
  return 'empty'
}

const EMPTY_HUBS: HubInfo[] = []

export function PageForm({ open, onClose, onSubmit, initial, isEdit, isHub: isHubProp, hubs = EMPTY_HUBS, protectedTabCount = 0, hubId }: PageFormProps) {
  const [name, setName] = useState('')
  const [tabs, setTabs] = useState<{ name: string; type: BlockType }[]>([])
  const [addingTab, setAddingTab] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [newTabType, setNewTabType] = useState<BlockType>('text')
  const [parentHubId, setParentHubId] = useState<number | undefined>(undefined)
  const [isHubType, setIsHubType] = useState(false)
  const [template, setTemplate] = useState<PageTemplate>('empty')
  const [trigger, setTrigger] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [blockList, setBlockList] = useState<BlockItem[]>([])
  const [deletedBlockIds, setDeletedBlockIds] = useState<number[]>([])
  const blocksModified = useRef(false)
  const [blockDragIdx, setBlockDragIdx] = useState<{ group: string; idx: number } | null>(null)
  const [, setBlockDropIdx] = useState<{ group: string; idx: number } | null>(null)
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
    if (isHubType) { setTemplate('empty'); return }
    const hub = hubs.find(h => h.id === parentHubId)
    setTemplate(getDefaultTemplate(hub))
  }, [parentHubId, isHubType, isEdit, hubs])

  const BLOCK_TYPE_DEFAULT_NAMES: Record<BlockType, string> = {
    timeline: 'Timeline', feedback: 'Feedback', visualization: 'Visualization', text: 'Notes', table: 'Table',
  }

  // Types already used (limited to 1 each except text)
  const usedTypes = new Set<BlockType>([
    ...tabs.map((t) => t.type),
    ...(initial?.blocks?.map((b) => b.type) ?? []),
  ])

  function handleTabTypeChange(type: BlockType) {
    setNewTabType(type)
    setNewTabName(BLOCK_TYPE_DEFAULT_NAMES[type])
  }

  function confirmTab() {
    if (newTabName.trim()) {
      setTabs((t) => [...t, { name: newTabName.trim(), type: newTabType }])
      setNewTabName('')
      setNewTabType('text')
      setAddingTab(false)
    }
  }

  function handleTabReorder(targetIdx: number) {
    if (!blockDragIdx || blockDragIdx.group !== 'tabs') return
    const sourceIdx = blockDragIdx.idx
    if (sourceIdx === targetIdx) return
    setTabs((prev) => {
      const next = [...prev]
      const [moved] = next.splice(sourceIdx, 1)
      next.splice(targetIdx, 0, moved)
      return next
    })
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
            <RadioOption selected={template === 'empty'} onChange={() => setTemplate('empty')} label="Empty" description="Add tabs later" />
          </div>
        </div>
      )}

      {/* Add to hub (creation only, page type only) */}
      {!isEdit && !isHubProp && !isHubType && hubs.length > 0 && (
        <div className={styles.section}>
          <span className={styles.label}>Add to</span>
          <select
            className={styles.selectInput}
            value={parentHubId ?? ''}
            onChange={(e) => setParentHubId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">None (standalone page)</option>
            {hubs.map((hub) => (
              <option key={hub.id} value={hub.id}>{hub.name}{hub.mentionTrigger ? ` (${hub.mentionTrigger})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Layout: Tabs & Blocks (edit mode OR creation with tabbed template) */}
      {((isEdit && !isHubProp) || (!isEdit && !isHubProp && !isHubType && template === 'tabbed')) && <div className={styles.section}>
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
        {isEdit && tabs.length === 0 && !addingTab && (
          <span className={styles.emptyHint}>Add tabs to organize page content</span>
        )}
        {/* All tabs — editable rows with drag, type label, name input, delete */}
        {tabs.map((tab, i) => (
          <div key={`tab-${i}`} className={styles.tabRow}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setBlockDragIdx({ group: 'tabs', idx: i }) }}
            onDragOver={(e) => { e.preventDefault(); setBlockDropIdx({ group: 'tabs', idx: i }) }}
            onDrop={(e) => { e.preventDefault(); handleTabReorder(i) }}
            onDragEnd={() => { setBlockDragIdx(null); setBlockDropIdx(null) }}
          >
            <div className={styles.dragHandle}><DragHandleIcon /></div>
            <span className={styles.tabTypeLabel}>({tab.type})</span>
            <input
              className={styles.textInput}
              style={{ flex: 1, height: 32 }}
              value={tab.name}
              onChange={(e) => setTabs((t) => t.map((tt, j) => j === i ? { ...tt, name: e.target.value } : tt))}
            />
            {!(protectedTabCount > 0 && i < protectedTabCount) && (
              <button className={styles.deleteButton} onClick={() => setTabs((t) => t.filter((_, j) => j !== i))} aria-label={`Delete ${tab.name}`}>
                <TrashIcon />
              </button>
            )}
          </div>
        ))}
        {addingTab && (
          <div className={styles.tabRow}>
            <select className={styles.selectInput} style={{ width: 'auto', flex: '0 0 auto' }} value={newTabType} onChange={(e) => handleTabTypeChange(e.target.value as BlockType)}>
              <option value="timeline" disabled={usedTypes.has('timeline')}>Timeline</option>
              <option value="feedback" disabled={usedTypes.has('feedback')}>Feedback</option>
              <option value="visualization" disabled={usedTypes.has('visualization')}>Visualization</option>
              <option value="text">Text</option>
            </select>
            <input className={styles.textInput} style={{ flex: 1, height: 32 }} type="text" value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmTab() }
                if (e.key === 'Escape') { setAddingTab(false); setNewTabName(''); setNewTabType('text') }
              }}
              placeholder="Tab name" autoFocus />
            <button className={styles.tabInputAction} onClick={confirmTab} aria-label="Confirm tab" style={{ opacity: newTabName.trim() ? 1 : 0.4, pointerEvents: newTabName.trim() ? 'auto' : 'none' }}>
              <CheckIcon />
            </button>
            <button className={styles.tabInputAction} onClick={() => { setAddingTab(false); setNewTabName(''); setNewTabType('text') }} aria-label="Cancel">
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
