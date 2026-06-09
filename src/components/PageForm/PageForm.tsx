import { useState, useEffect, useRef, useCallback } from 'react'
import { Modal } from '../Modal/Modal'
import { ConfirmModal } from '../ConfirmModal/ConfirmModal'
import { PropertyEditorContent } from '../PropertyEditor/PropertyEditor'
import { DragHandleIcon, TrashIcon, CheckIcon, PlusIcon, CloseIcon } from '../Icons/Icons'
import { DropdownPortal } from '../DropdownPortal/DropdownPortal'
import { db } from '../../db/database'
import { useToast } from '../../hooks/useToast'
import { makeRadioKeyHandler } from '../../utils/radioKeyHandler'
import type { BlockType } from '../../types'
import styles from './PageForm.module.css'
import radio from '../../styles/radio.module.css'

export interface PageFormData {
  name: string
  tabs: { id?: number; name: string; type: BlockType }[]
  parentHubId?: number
  isHub: boolean
  existingPageId?: number
  mentionTrigger?: string
  mentionCollapsed?: boolean
  inheritedTrigger?: string
  inheritedFrom?: string
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
  hubId?: number  // when editing a hub, enables step 2 (property config)
}

function RadioOption({ selected, onChange, label, description, disabled, tabIdx }: {
  selected: boolean; onChange: () => void; label: string; description?: string; disabled?: boolean; tabIdx?: number
}) {
  return (
    <button
      className={disabled ? styles.radioOptionDisabled : radio.radioOption}
      onClick={disabled ? undefined : onChange}
      role="radio"
      aria-checked={selected}
      tabIndex={disabled ? -1 : (tabIdx ?? (selected ? 0 : -1))}
    >
      <div className={radio.radioCircle} data-checked={selected} />
      <span>{label}</span>
      {description && <span className={styles.radioDescription}>{description}</span>}
    </button>
  )
}

const EMPTY_HUBS: HubInfo[] = []

const BLOCK_TYPE_LABELS: Partial<Record<BlockType, string>> = {
  text: 'Text',
  timeline: 'Timeline',
  feedback: 'Feedback',
  visualization: 'Charts',
}

export function PageForm({ open, onClose, onSubmit, initial, isEdit, isHub: isHubProp, hubs = EMPTY_HUBS, hubId }: PageFormProps) {
  const { show: showToast } = useToast()
  const [name, setName] = useState('')
  const [tabs, setTabs] = useState<{ name: string; type: BlockType; key: number }[]>([])
  const [addingTab, setAddingTab] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [newTabType, setNewTabType] = useState<BlockType>('text')
  const [parentHubId, setParentHubId] = useState<number | undefined>(undefined)
  const [isHubType, setIsHubType] = useState(false)
  const [trigger, setTrigger] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [blockDragIdx, setBlockDragIdx] = useState<{ group: string; idx: number } | null>(null)
  const prevOpen = useRef(false)
  const [createdHubId, setCreatedHubId] = useState<number | null>(null)
  const hubConfirmed = useRef(false)
  const [hubSelectOpen, setHubSelectOpen] = useState(false)
  const hubSelectAnchorRef = useRef<HTMLDivElement>(null)
  const [blockTypeSelectOpen, setBlockTypeSelectOpen] = useState(false)
  const blockTypeAnchorRef = useRef<HTMLDivElement>(null)
  const blockTypeBtnRef = useRef<HTMLButtonElement>(null)
  const [tabDeleteConfirm, setTabDeleteConfirm] = useState<number | null>(null)
  const tabKeyCounter = useRef(0)

  useEffect(() => {
    if (addingTab) blockTypeBtnRef.current?.focus()
  }, [addingTab])

  // Creating a new hub — properties appear immediately when Hub type is selected
  const isCreatingHub = !isEdit && isHubType

  // Create placeholder hub immediately when user selects Hub type
  useEffect(() => {
    if (!open || isEdit) return
    if (isHubType && !createdHubId) {
      ;(async () => {
        try {
          const id = await db.pages.add({
            name: 'Untitled',
            type: 'hub' as const,
            isDraft: true,
            description: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            editCount: 0,
          })
          setCreatedHubId(id as number)
        } catch { /* DB unavailable — hub creation will fail gracefully on confirm */ }
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
      // Delete the placeholder hub and any properties/blocks/chartConfigs created on it
      await db.transaction('rw', [db.pages, db.blocks, db.hubProperties, db.pagePropertyValues, db.chartConfigs], async () => {
        // Delete chart configs for any visualization blocks
        const vizBlocks = await db.blocks.where('pageId').equals(createdHubId).filter((b) => b.type === 'visualization').toArray()
        const vizBlockIds = vizBlocks.map((b) => b.id!)
        if (vizBlockIds.length > 0) {
          await db.chartConfigs.where('blockId').anyOf(vizBlockIds).delete()
        }
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
      tabKeyCounter.current = 0
      setTabs((initial?.tabs ?? []).map((t) => ({ ...t, key: tabKeyCounter.current++ })))
      setAddingTab(false)
      setNewTabName('')
      setParentHubId(initial?.parentHubId)
      setIsHubType(false)
      setTrigger(initial?.mentionTrigger ?? '')
      setCollapsed(initial?.mentionCollapsed ?? false)
      setBlockDragIdx(null)
      setCreatedHubId(null)
      hubConfirmed.current = false
    }
    prevOpen.current = open
  }, [open, initial, hubs])

  // Pre-populate default tabs based on parent hub type
  useEffect(() => {
    if (isEdit || isHubType) return
    const hub = hubs.find(h => h.id === parentHubId)
    if (hub?.role === 'colleague-hub' || hub?.role === 'project-hub') {
      tabKeyCounter.current = 0
      setTabs([
        { name: 'Timeline', type: 'timeline', key: tabKeyCounter.current++ },
        { name: 'Feedback', type: 'feedback', key: tabKeyCounter.current++ },
        { name: 'Visualization', type: 'visualization', key: tabKeyCounter.current++ },
      ])
    } else {
      setTabs([])
    }
  }, [parentHubId, isHubType, isEdit, hubs])

  const BLOCK_TYPE_DEFAULT_NAMES: Record<BlockType, string> = {
    timeline: 'Timeline', feedback: 'Feedback', visualization: 'Visualization', text: 'Notes', table: 'Table',
  }

  // Types already used (limited to 1 each except text)
  const usedTypes = new Set<BlockType>(
    tabs.map((t) => t.type)
  )

  function handleTabTypeChange(type: BlockType) {
    setNewTabType(type)
    setNewTabName(BLOCK_TYPE_DEFAULT_NAMES[type])
  }

  function confirmTab() {
    // Guard against duplicate non-text types
    if (newTabType !== 'text' && usedTypes.has(newTabType)) return
    const name = newTabName.trim() || (BLOCK_TYPE_LABELS[newTabType] ?? newTabType)
    setTabs((t) => [...t, { name, type: newTabType, key: tabKeyCounter.current++ }])
    setNewTabName('')
    setNewTabType('text')
    setAddingTab(false)
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
    // Strip internal key from tabs before submitting
    const submitTabs = tabs.map(({ name, type }) => ({ name, type }))

    // Hub creation: hub already exists as placeholder, finalize it
    if (isCreatingHub && createdHubId) {
      try {
        hubConfirmed.current = true
        // Update the hub with final name/trigger, clear draft flag
        await db.pages.update(createdHubId, {
          name: name.trim() || 'Untitled',
          mentionTrigger: trigger || undefined,
          mentionCollapsed: collapsed || undefined,
          isDraft: undefined,
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
          name, tabs: submitTabs, parentHubId: undefined, isHub: true,
          existingPageId: createdHubId,
          mentionTrigger: trigger || undefined, mentionCollapsed: collapsed || undefined,
        })
      } catch {
        hubConfirmed.current = false
        showToast('Failed to create hub')
      }
      return
    }

    // Normal submit (edit mode or non-hub creation)
    onSubmit({
      name, tabs: submitTabs, parentHubId: isHubType ? undefined : parentHubId, isHub: isHubType,
      mentionTrigger: trigger || undefined, mentionCollapsed: collapsed || undefined,
    })
  }

  // Effective hubId for property editor (either from prop or from just-created hub)
  const effectiveHubId = hubId ?? createdHubId ?? undefined

  return (
    <>
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
        <input className={styles.textInput} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter page name" aria-label="Page name" />
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
                  <button className={styles.labelToggle} onClick={() => setCollapsed(!collapsed)} type="button" role="checkbox" aria-checked={!collapsed} tabIndex={0}>
                    <div className={styles.labelCheckbox} data-checked={!collapsed} />
                    <span className={styles.labelText}>Label</span>
                  </button>
                )}
                {!trigger && <span className={styles.radioDescription}>Use single special character</span>}
                {trigger && hubs.some(h => h.mentionTrigger === trigger && h.id !== initial?.existingPageId) && (
                  <span className={styles.radioDescription} style={{ color: 'var(--color-negative)' }}>Already used by {hubs.find(h => h.mentionTrigger === trigger && h.id !== initial?.existingPageId)?.name}</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Type — Page or Hub (creation only) */}
      {!isEdit && !isHubProp && (
        <div className={styles.section}>
          <span className={styles.label}>Type</span>
          <div
            className={styles.radioCol}
            role="radiogroup"
            aria-label="Page type"
            onKeyDown={makeRadioKeyHandler([false, true], isHubType, setIsHubType)}
          >
            <RadioOption selected={!isHubType} onChange={() => setIsHubType(false)} label="Page" />
            <RadioOption selected={isHubType} onChange={() => setIsHubType(true)} label="Hub" />
          </div>
        </div>
      )}

      {/* Add to hub (creation only, page type only) */}
      {!isEdit && !isHubProp && !isHubType && hubs.length > 0 && (
        <div className={styles.section}>
          <span className={styles.label}>Add to</span>
          <div ref={hubSelectAnchorRef} style={{ position: 'relative', width: '100%' }}>
            <button
              className={styles.hubSelectTrigger}
              onClick={() => setHubSelectOpen((v) => !v)}
              aria-expanded={hubSelectOpen}
              aria-haspopup="listbox"
              type="button"
              tabIndex={0}
            >
              <span>
                {parentHubId
                  ? (() => { const h = hubs.find(h => h.id === parentHubId); return h ? `${h.name}${h.mentionTrigger ? ` (${h.mentionTrigger})` : ''}` : 'None (standalone page)' })()
                  : 'None (standalone page)'}
              </span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <DropdownPortal anchorRef={hubSelectAnchorRef} open={hubSelectOpen} onClose={() => setHubSelectOpen(false)} autoFocus>
              <div className={styles.hubSelectMenu} role="listbox">
                <button className={!parentHubId ? styles.hubSelectItemActive : styles.hubSelectItem} role="option" onClick={() => { setParentHubId(undefined); setHubSelectOpen(false) }}>
                  None (standalone page)
                </button>
                {hubs.map((hub) => (
                  <button key={hub.id} className={parentHubId === hub.id ? styles.hubSelectItemActive : styles.hubSelectItem} role="option" onClick={() => { setParentHubId(hub.id); setHubSelectOpen(false) }}>
                    <span>{hub.name}</span>
                    {hub.mentionTrigger && <kbd className={styles.triggerBadge}>{hub.mentionTrigger}</kbd>}
                  </button>
                ))}
              </div>
          </DropdownPortal>
        </div>
      )}

      {/* Layout: Tabs */}
      {!isHubProp && !isHubType && <div className={styles.section}>
        <div className={styles.tabHeader}>
          <span className={styles.label}>Layout</span>
          {!addingTab && (
            <button className={styles.addButton} onClick={() => setAddingTab(true)} aria-label="Add tab" tabIndex={0}>
              <PlusIcon />
            </button>
          )}
        </div>
        {tabs.length === 0 && !addingTab && (
          <span className={styles.emptyHint}>Add tabs to organize page content</span>
        )}
        {/* All tabs — editable rows with drag, type label, name input, delete */}
        {tabs.map((tab, i) => (
          <div key={tab.key} className={styles.tabRow}
            tabIndex={0}
            role="group"
            aria-label={`${tab.name || 'Unnamed'} tab (${tab.type === 'visualization' ? 'charts' : tab.type})`}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setBlockDragIdx({ group: 'tabs', idx: i }) }}
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => { e.preventDefault(); handleTabReorder(i) }}
            onDragEnd={() => { setBlockDragIdx(null) }}
          >
            <div className={styles.dragHandle}><DragHandleIcon /></div>
            <span className={styles.tabTypeLabel}>({tab.type === 'visualization' ? 'charts' : tab.type})</span>
            <input
              className={styles.textInput}
              style={{ width: 200, height: 32 }}
              value={tab.name}
              onChange={(e) => setTabs((t) => t.map((tt, j) => j === i ? { ...tt, name: e.target.value } : tt))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  ;(e.target as HTMLElement).blur()
                }
              }}
              tabIndex={0}
            />
            <button className={styles.deleteButton} onClick={() => setTabDeleteConfirm(i)} aria-label={`Delete ${tab.name}`} tabIndex={0}>
              <TrashIcon />
            </button>
          </div>
        ))}
        {addingTab && (
          <div className={styles.tabRow} onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setAddingTab(false)
              setNewTabType('text')
            }
            if (e.key === 'Enter' || e.key === ' ') {
              if ((e.target as HTMLElement).tagName === 'BUTTON') return
              e.preventDefault()
              confirmTab()
            }
          }}>
            <div ref={blockTypeAnchorRef} style={{ flex: 1, minWidth: 0, display: 'flex' }}>
              <button
                ref={blockTypeBtnRef}
                className={styles.blockTypeSelectTrigger}
                onClick={() => setBlockTypeSelectOpen((v) => !v)}
                type="button"
                tabIndex={0}
              >
                {BLOCK_TYPE_LABELS[newTabType] ?? newTabType}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <DropdownPortal anchorRef={blockTypeAnchorRef} open={blockTypeSelectOpen} onClose={() => setBlockTypeSelectOpen(false)} autoFocus>
                <div className={styles.hubSelectMenu} role="listbox">
                  {(['timeline', 'feedback', 'visualization', 'text'] as BlockType[]).map((type) => {
                    const disabled = type !== 'text' && usedTypes.has(type)
                    return (
                      <button
                        key={type}
                        className={disabled ? styles.hubSelectItemDisabled : (newTabType === type ? styles.hubSelectItemActive : styles.hubSelectItem)}
                        onClick={disabled ? undefined : () => { handleTabTypeChange(type); setBlockTypeSelectOpen(false) }}
                        role="option"
                        type="button"
                      >
                        {BLOCK_TYPE_LABELS[type] ?? type}
                      </button>
                    )
                  })}
                </div>
            </DropdownPortal>
            <button className={styles.tabInputAction} onClick={confirmTab} aria-label="Confirm tab" type="button" tabIndex={0}>
              <CheckIcon />
            </button>
            <button className={styles.tabInputAction} onClick={() => { setAddingTab(false); setNewTabType('text') }} aria-label="Cancel" type="button" tabIndex={0}>
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
    <ConfirmModal
      open={tabDeleteConfirm !== null}
      title="Delete tab"
      message={tabDeleteConfirm !== null ? `Are you sure you want to delete the "${tabs[tabDeleteConfirm]?.name}" tab? Its content will be permanently removed.` : ''}
      onClose={() => setTabDeleteConfirm(null)}
      onConfirm={() => { setTabs((t) => t.filter((_, j) => j !== tabDeleteConfirm!)); setTabDeleteConfirm(null) }}
    />
    </>
  )
}
