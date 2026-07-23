import { useState, useEffect, useRef, useMemo } from 'react'
import { useRadioGroupKeyboard } from '../../hooks/useRadioGroupKeyboard'
import { Modal } from '../Modal/Modal'
import { DropdownPortal } from '../DropdownPortal/DropdownPortal'
import { SOURCE_LABELS, VALID_GROUPINGS, CHART_TYPES_FOR_GROUPING, GROUPING_LABELS } from './chartConstants'
import type { ChartSource, ChartGrouping, ChartType, ChartConfig, ChartScope, Page, EntryTag } from '../../types'
import styles from './Charts.module.css'
import radio from '../../styles/radio.module.css'

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar', line: 'Line', area: 'Area', pie: 'Pie',
}

// ---- Scope helpers ----

interface ScopeOption {
  label: string
  scope: ChartScope
  key: string
  isChild?: boolean
}

function scopeKey(s: ChartScope): string {
  if (s.type === 'page') return `page-${s.pageId}`
  if (s.type === 'hub') return `hub-${s.hubId}`
  return 'global'
}

function scopesEqual(a: ChartScope, b: ChartScope): boolean {
  return scopeKey(a) === scopeKey(b)
}

function toggleScope(scopes: ChartScope[], scope: ChartScope): ChartScope[] {
  const idx = scopes.findIndex((s) => scopesEqual(s, scope))
  if (idx >= 0) return scopes.filter((_, i) => i !== idx)
  return [...scopes, scope]
}

function isScopeSelected(scopes: ChartScope[], scope: ChartScope): boolean {
  return scopes.some((s) => scopesEqual(s, scope))
}

// ---- Component ----

interface AddChartModalProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string, source: ChartSource, grouping: ChartGrouping, chartType: ChartType, scopes?: ChartScope[], aggregateByHub?: boolean, categories?: string[]) => void
  editing?: ChartConfig
  onUpdate?: (id: number, name: string, source: ChartSource, grouping: ChartGrouping, chartType: ChartType, scopes?: ChartScope[], aggregateByHub?: boolean, categories?: string[]) => void
  pageId: number
  allPages: Page[]
  entryTags: EntryTag[]
}

const ALL_SOURCES: ChartSource[] = ['classify', 'entries', 'pages']

export function AddChartModal({ open, onClose, onAdd, editing, onUpdate, pageId, allPages, entryTags }: AddChartModalProps) {
  const [name, setName] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [scopes, setScopes] = useState<ChartScope[]>([])
  const [source, setSource] = useState<ChartSource>(editing?.source ?? 'classify')
  const [grouping, setGrouping] = useState<ChartGrouping>(editing?.grouping ?? 'month')
  const [type, setType] = useState<ChartType>(editing?.chartType ?? 'bar')
  const [aggregateByHub, setAggregateByHub] = useState(editing?.aggregateByHub ?? false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const prevOpen = useRef(false)
  const userEditedName = useRef(false)
  const scopeTriggerRef = useRef<HTMLButtonElement>(null)
  const sourceTriggerRef = useRef<HTMLButtonElement>(null)

  const currentPage = allPages.find((p) => p.id === pageId)

  const categoryOptions = useMemo(() => {
    const cats = ['Work', ...entryTags.map((t) => t.category)]
    return [...new Set(cats)]
  }, [entryTags])

  function toggleCategory(cat: string) {
    setCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])
  }

  // Build scope options
  const scopeOptions = useMemo<ScopeOption[]>(() => {
    const opts: ScopeOption[] = [
      { label: 'This page', scope: { type: 'page', pageId }, key: `page-${pageId}` },
    ]
    const mainTimeline = allPages.find((p) => p.role === 'main-timeline' && p.id !== pageId)
    if (mainTimeline) {
      opts.push({ label: mainTimeline.name, scope: { type: 'page', pageId: mainTimeline.id! }, key: `page-${mainTimeline.id}` })
    }
    for (const hub of allPages) {
      if (hub.type !== 'hub') continue
      opts.push({ label: hub.name, scope: { type: 'hub', hubId: hub.id! }, key: `hub-${hub.id}` })
      const children = allPages.filter((p) => p.parentId === hub.id && p.type !== 'candidate')
      for (const child of children) {
        if (child.id === pageId) continue
        opts.push({ label: child.name, scope: { type: 'page', pageId: child.id! }, key: `page-${child.id}`, isChild: true })
      }
    }
    for (const p of allPages) {
      if (p.type !== 'hub' && !p.parentId && p.id !== pageId && p.role !== 'main-timeline') {
        opts.push({ label: p.name, scope: { type: 'page', pageId: p.id! }, key: `page-${p.id}` })
      }
    }
    return opts
  }, [allPages, pageId])

  // Scope summary text
  const scopeSummary = useMemo(() => {
    if (scopes.length === 0) return 'All'
    if (scopes.length === 1) {
      const match = scopeOptions.find((o) => scopesEqual(o.scope, scopes[0]))
      return match?.label ?? '1 selected'
    }
    return `${scopes.length} selected`
  }, [scopes, scopeOptions])

  // Valid groupings for current source
  const validGroupings = VALID_GROUPINGS[source]
  const effectiveGrouping = validGroupings.includes(grouping) ? grouping : validGroupings[0]

  // Valid chart types — classify supports pie
  const baseValidTypes = CHART_TYPES_FOR_GROUPING[effectiveGrouping]
  const validTypes = source === 'classify'
    ? [...new Set([...baseValidTypes, 'pie' as ChartType])]
    : baseValidTypes
  const effectiveType = validTypes.includes(type) ? type : validTypes[0]
  const { groupRef: chartTypeGroupRef, handleKeyDown: chartTypeKeyDown } = useRadioGroupKeyboard(validTypes, effectiveType, setType)

  // Reset form when modal opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      setScopeOpen(false)
      setSourceOpen(false)
      if (editing) {
        setName(editing.name ?? '')
        setScopes(editing.scopes ?? [])
        setSource(editing.source)
        setGrouping(editing.grouping)
        setType(editing.chartType)
        setAggregateByHub(editing.aggregateByHub ?? false)
        setCategories(editing.categories ?? [])
        userEditedName.current = true
      } else {
        setName('')
        const defaultScope: ChartScope[] = currentPage?.type === 'hub'
          ? [{ type: 'hub', hubId: pageId }]
          : [{ type: 'page', pageId }]
        setScopes(defaultScope)
        setSource('classify')
        setGrouping('month')
        setType('bar')
        setAggregateByHub(false)
        setCategories([])
        userEditedName.current = false
      }
    }
    prevOpen.current = open
  }, [open, editing, allPages, pageId, currentPage])

  function handleConfirm() {
    const chartName = name.trim() || (SOURCE_LABELS[source] ?? 'Chart')
    const scopesValue = scopes.length > 0 ? scopes : undefined
    const hubAgg = effectiveType === 'pie' && aggregateByHub ? true : undefined
    const cats = source === 'classify' && categories.length > 0 ? categories : undefined
    if (editing && onUpdate) {
      onUpdate(editing.id!, chartName, source, effectiveGrouping, effectiveType, scopesValue, hubAgg, cats)
    } else {
      onAdd(chartName, source, effectiveGrouping, effectiveType, scopesValue, hubAgg, cats)
    }
    onClose()
  }

  return (
    <Modal
      title={editing ? 'Edit chart' : 'Add chart'}
      open={open}
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <div className={styles.addChartForm}>
        {/* Chart name */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Name</span>
          <input
            className={styles.formInput}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); userEditedName.current = true }}
            placeholder="Chart name"
            aria-label="Chart name"
          />
        </div>

        {/* Scope — multi-select dropdown */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Scope</span>
          <div className={styles.scopeDropdown}>
            <button
              className={styles.scopeTrigger}
              onClick={() => setScopeOpen((v) => !v)}
              type="button"
              ref={scopeTriggerRef}
              aria-expanded={scopeOpen}
              aria-label="Scope"
              tabIndex={0}
            >
              <span>{scopeSummary}</span>
              <svg className={scopeOpen ? styles.scopeChevronOpen : styles.scopeChevron} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 13.0729L7.42708 8.5L5.92708 10L12 16.0729L18.0729 10L16.5729 8.5L12 13.0729Z" fill="currentColor" />
              </svg>
            </button>
            <DropdownPortal anchorRef={scopeTriggerRef} open={scopeOpen} onClose={() => setScopeOpen(false)} autoFocus>
              <div className={styles.scopePanel} data-dropdown-panel role="listbox" aria-multiselectable="true" aria-label="Scope">
                {scopeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={opt.isChild ? `${styles.scopeOption} ${styles.scopeOptionChild}` : styles.scopeOption}
                    onClick={() => setScopes(toggleScope(scopes, opt.scope))}
                    type="button"
                    role="option"
                    aria-selected={isScopeSelected(scopes, opt.scope)}
                  >
                    <div
                      className={styles.scopeCheckbox}
                      data-checked={isScopeSelected(scopes, opt.scope)}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            </DropdownPortal>
          </div>
        </div>

        {/* Data source */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Data source</span>
          <div className={styles.scopeDropdown}>
            <button
              className={styles.scopeTrigger}
              onClick={() => setSourceOpen((v) => !v)}
              type="button"
              ref={sourceTriggerRef}
              aria-expanded={sourceOpen}
              aria-label="Data source"
              tabIndex={0}
            >
              <span>{SOURCE_LABELS[source]}</span>
              <svg className={sourceOpen ? styles.scopeChevronOpen : styles.scopeChevron} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 13.0729L7.42708 8.5L5.92708 10L12 16.0729L18.0729 10L16.5729 8.5L12 13.0729Z" fill="currentColor" />
              </svg>
            </button>
            <DropdownPortal anchorRef={sourceTriggerRef} open={sourceOpen} onClose={() => setSourceOpen(false)} autoFocus>
              <div className={styles.scopePanel} data-dropdown-panel role="listbox" aria-label="Data source">
                {ALL_SOURCES.map((s) => (
                  <button
                    key={s}
                    className={styles.scopeOption}
                    onClick={() => { setSource(s); setSourceOpen(false); if (!userEditedName.current) setName('') }}
                    type="button"
                    role="option"
                    aria-selected={source === s}
                  >
                    <div className={styles.scopeRadio} data-checked={source === s} />
                    {SOURCE_LABELS[s]}
                  </button>
                ))}
              </div>
            </DropdownPortal>
          </div>
        </div>

        {/* Categories — only for classify source */}
        {source === 'classify' && (
          <div className={styles.formSection}>
            <span className={styles.formLabel}>Categories</span>
            <div className={styles.categoryList} role="group" aria-label="Categories">
              {categoryOptions.map((cat) => (
                <button key={cat} className={styles.scopeOption} onClick={() => toggleCategory(cat)} type="button" role="checkbox" aria-checked={categories.length === 0 || categories.includes(cat)} tabIndex={0}>
                  <div className={styles.scopeCheckbox} data-checked={categories.length === 0 || categories.includes(cat)} />
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grouping — only show when >1 valid option */}
        {validGroupings.length > 1 && (
          <div className={styles.formSection}>
            <span className={styles.formLabel}>Group by</span>
            <div className={styles.radioRow} role="radiogroup" aria-label="Group by">
              {validGroupings.map((g) => (
                <button key={g} className={radio.radioOption} onClick={() => setGrouping(g)} role="radio" aria-checked={effectiveGrouping === g} tabIndex={effectiveGrouping === g ? 0 : -1}>
                  <div className={radio.radioCircle} data-checked={effectiveGrouping === g} />
                  {GROUPING_LABELS[g]}
                </button>
              ))}
            </div>
          </div>
        )}


        {/* Chart type */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Chart type</span>
          <div ref={chartTypeGroupRef} className={styles.radioRow} role="radiogroup" aria-label="Chart type" onKeyDown={chartTypeKeyDown}>
            {validTypes.map((t) => (
              <button key={t} className={radio.radioOption} onClick={() => setType(t)} role="radio" aria-checked={effectiveType === t} tabIndex={effectiveType === t ? 0 : -1}>
                <div className={radio.radioCircle} data-checked={effectiveType === t} />
                {CHART_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {effectiveType === 'pie' && scopes.some((s) => s.type === 'hub') && source !== 'classify' && (
          <div className={styles.formSection}>
            <button className={styles.scopeOption} onClick={() => setAggregateByHub(!aggregateByHub)} type="button" role="checkbox" aria-checked={aggregateByHub} tabIndex={0}>
              <div className={styles.scopeCheckbox} data-checked={aggregateByHub} />
              Aggregate by hub
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
