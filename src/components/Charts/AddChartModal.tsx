import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRadioGroupKeyboard } from '../../hooks/useRadioGroupKeyboard'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/database'
import { Modal } from '../Modal/Modal'
import { DropdownPortal } from '../DropdownPortal/DropdownPortal'
import { SOURCE_LABELS, VALID_GROUPINGS, CHART_TYPES_FOR_GROUPING, GROUPING_LABELS } from './ChartRenderer'
import { useHubAssignedPatterns } from '../../hooks/useRegexPatterns'
import type { ChartSource, ChartGrouping, ChartType, ChartConfig, ChartScope, Page, HubProperty, RegexPattern } from '../../types'
import styles from './Charts.module.css'
import radio from '../../styles/radio.module.css'

const BUILTIN_SOURCES: ChartSource[] = ['entries', 'pages']

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
  onAdd: (name: string, source: ChartSource, grouping: ChartGrouping, chartType: ChartType, scopes?: ChartScope[], propertyId?: number, aggregateByHub?: boolean, regexPatternIds?: number[]) => void
  editing?: ChartConfig
  onUpdate?: (id: number, name: string, source: ChartSource, grouping: ChartGrouping, chartType: ChartType, scopes?: ChartScope[], propertyId?: number, aggregateByHub?: boolean, regexPatternIds?: number[]) => void
  pageId: number
  allPages: Page[]
}

export function AddChartModal({ open, onClose, onAdd, editing, onUpdate, pageId, allPages }: AddChartModalProps) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ChartScope[]>([])
  const [source, setSource] = useState<ChartSource>(editing?.source ?? 'regex')
  const [grouping, setGrouping] = useState<ChartGrouping>(editing?.grouping ?? 'month')
  const [type, setType] = useState<ChartType>(editing?.chartType ?? 'bar')
  const [propertyId, setPropertyId] = useState<number | undefined>(editing?.propertyId)
  const [regexPatternIds, setRegexPatternIds] = useState<number[]>(editing?.regexPatternIds ?? [])
  const [aggregateByHub, setAggregateByHub] = useState(editing?.aggregateByHub ?? false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const prevOpen = useRef(false)
  const userEditedName = useRef(false)
  const scopeRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const scopeTriggerRef = useRef<HTMLButtonElement>(null)
  const sourceTriggerRef = useRef<HTMLButtonElement>(null)

  // Load all hub properties for the property picker
  const allHubProperties = useLiveQuery(() => db.hubProperties.toArray(), []) ?? [] as HubProperty[]
  const pageProperties = allHubProperties.filter((p: HubProperty) => !p.scope || p.scope === 'page')

  // Determine relevant hub for regex pattern loading
  const currentPage = allPages.find((p) => p.id === pageId)
  const relevantHubId = currentPage?.type === 'hub' ? pageId : currentPage?.parentId
  const assignedPatterns = useHubAssignedPatterns(relevantHubId)

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

  // Close dropdowns on click outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest?.('[data-dropdown-panel]')) return
    if (scopeRef.current && !scopeRef.current.contains(target)) {
      setScopeOpen(false)
    }
    if (sourceRef.current && !sourceRef.current.contains(target)) {
      setSourceOpen(false)
    }
  }, [])

  useEffect(() => {
    if (scopeOpen || sourceOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [scopeOpen, sourceOpen, handleClickOutside])

  // Scope summary text
  const scopeSummary = useMemo(() => {
    if (scopes.length === 0) return 'All'
    if (scopes.length === 1) {
      const match = scopeOptions.find((o) => scopesEqual(o.scope, scopes[0]))
      return match?.label ?? '1 selected'
    }
    return `${scopes.length} selected`
  }, [scopes, scopeOptions])

  // Source display text
  const sourceDisplayText = useMemo(() => {
    if (source === 'property') {
      return pageProperties.find((p: HubProperty) => p.id === propertyId)?.name ?? 'Select property...'
    }
    if (source === 'regex') {
      if (regexPatternIds.length === 0) return 'Select pattern...'
      if (regexPatternIds.length === 1) return assignedPatterns.find((p: RegexPattern) => p.id === regexPatternIds[0])?.name ?? 'Select pattern...'
      if (regexPatternIds.length === 2) return regexPatternIds.map((id) => assignedPatterns.find((p: RegexPattern) => p.id === id)?.name).filter(Boolean).join(', ')
      return `${regexPatternIds.length} patterns`
    }
    return SOURCE_LABELS[source]
  }, [source, propertyId, regexPatternIds, pageProperties, assignedPatterns])

  // Valid groupings for current source
  const validGroupings = VALID_GROUPINGS[source]
  const effectiveGrouping = validGroupings.includes(grouping) ? grouping : validGroupings[0]

  // Valid chart types for current grouping
  const validTypes = CHART_TYPES_FOR_GROUPING[effectiveGrouping]
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
        setPropertyId(editing.propertyId)
        setRegexPatternIds(editing.regexPatternIds ?? [])
        setAggregateByHub(editing.aggregateByHub ?? false)
        userEditedName.current = true
      } else {
        const firstPattern = assignedPatterns[0]
        setName(firstPattern?.name ?? '')
        const defaultScope: ChartScope[] = currentPage?.type === 'hub'
          ? [{ type: 'hub', hubId: pageId }]
          : [{ type: 'page', pageId }]
        setScopes(defaultScope)
        setSource(firstPattern ? 'regex' : 'entries')
        setGrouping(firstPattern ? 'month' : 'weekday')
        setType('bar')
        setPropertyId(undefined)
        setRegexPatternIds(firstPattern ? [firstPattern.id!] : [])
        setAggregateByHub(false)
        userEditedName.current = false
      }
    }
    prevOpen.current = open
  }, [open, editing, allPages, pageId, assignedPatterns, currentPage])

  function handleConfirm() {
    const chartName = name.trim() || (source === 'regex'
      ? (regexPatternIds.length === 1
        ? (assignedPatterns.find((p: RegexPattern) => p.id === regexPatternIds[0])?.name ?? 'Chart')
        : regexPatternIds.length > 1
          ? regexPatternIds.map((id) => assignedPatterns.find((p: RegexPattern) => p.id === id)?.name).filter(Boolean).join(', ')
          : 'Chart')
      : source === 'property'
        ? (pageProperties.find((p: HubProperty) => p.id === propertyId)?.name ?? 'Chart')
        : (SOURCE_LABELS[source] ?? 'Chart'))
    const scopesValue = scopes.length > 0 ? scopes : undefined
    const propId = source === 'property' ? propertyId : undefined
    const regIds = source === 'regex' && regexPatternIds.length > 0 ? regexPatternIds : undefined
    const hubAgg = effectiveType === 'pie' && aggregateByHub ? true : undefined
    if (editing && onUpdate) {
      onUpdate(editing.id!, chartName, source, effectiveGrouping, effectiveType, scopesValue, propId, hubAgg, regIds)
    } else {
      onAdd(chartName, source, effectiveGrouping, effectiveType, scopesValue, propId, hubAgg, regIds)
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
          <div className={styles.scopeDropdown} ref={scopeRef}>
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

        {/* Data source — unified dropdown */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Data source</span>
          <div className={styles.scopeDropdown} ref={sourceRef}>
            <button
              className={styles.scopeTrigger}
              onClick={() => setSourceOpen((v) => !v)}
              type="button"
              ref={sourceTriggerRef}
              aria-expanded={sourceOpen}
              aria-label="Data source"
              tabIndex={0}
            >
              <span>{sourceDisplayText}</span>
              <svg className={sourceOpen ? styles.scopeChevronOpen : styles.scopeChevron} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 13.0729L7.42708 8.5L5.92708 10L12 16.0729L18.0729 10L16.5729 8.5L12 13.0729Z" fill="currentColor" />
              </svg>
            </button>
            <DropdownPortal anchorRef={sourceTriggerRef} open={sourceOpen} onClose={() => setSourceOpen(false)} autoFocus>
              <div className={styles.scopePanel} data-dropdown-panel role="listbox" aria-label="Data source">
                {assignedPatterns.map((rp: RegexPattern) => (
                  <button
                    key={`regex-${rp.id}`}
                    className={styles.scopeOption}
                    onClick={() => {
                      setSource('regex')
                      setPropertyId(undefined)
                      setRegexPatternIds((prev) => {
                        const next = prev.includes(rp.id!) ? prev.filter((id) => id !== rp.id) : [...prev, rp.id!]
                        if (!userEditedName.current) {
                          if (next.length === 1) setName(assignedPatterns.find((p: RegexPattern) => p.id === next[0])?.name ?? '')
                          else setName('')
                        }
                        return next
                      })
                    }}
                    type="button"
                    role="option"
                    aria-selected={source === 'regex' && regexPatternIds.includes(rp.id!)}
                  >
                    <div
                      className={styles.scopeCheckbox}
                      data-checked={source === 'regex' && regexPatternIds.includes(rp.id!)}
                    />
                    {rp.name}
                  </button>
                ))}
                {BUILTIN_SOURCES.map((s) => (
                  <button
                    key={s}
                    className={styles.scopeOption}
                    onClick={() => { setSource(s); setPropertyId(undefined); setRegexPatternIds([]); setSourceOpen(false); if (!userEditedName.current) setName(SOURCE_LABELS[s] ?? '') }}
                    type="button"
                    role="option"
                    aria-selected={source === s && !propertyId}
                  >
                    <div
                      className={styles.scopeRadio}
                      data-checked={source === s && !propertyId}
                    />
                    {SOURCE_LABELS[s]}
                  </button>
                ))}
                {pageProperties.length > 0 && pageProperties.map((prop: HubProperty) => {
                  const hub = allPages.find((p) => p.id === prop.hubId)
                  return (
                    <button
                      key={`prop-${prop.id}`}
                      className={styles.scopeOption}
                      onClick={() => { setSource('property'); setPropertyId(prop.id); setRegexPatternIds([]); setSourceOpen(false); if (!userEditedName.current) setName(prop.name ?? '') }}
                      type="button"
                      role="option"
                      aria-selected={source === 'property' && propertyId === prop.id}
                    >
                      <div
                        className={styles.scopeRadio}
                        data-checked={source === 'property' && propertyId === prop.id}
                      />
                      {hub ? `${hub.name} — ${prop.name}` : prop.name}
                    </button>
                  )
                })}
              </div>
            </DropdownPortal>
          </div>
        </div>

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

        {effectiveType === 'pie' && scopes.some((s) => s.type === 'hub') && (
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
