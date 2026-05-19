import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/database'
import { Modal } from '../Modal/Modal'
import { DATA_SOURCE_LABELS, VALID_CHART_TYPES } from './ChartRenderer'
import type { ChartDataSource, ChartType, ChartConfig, ChartScope, Page, HubProperty } from '../../types'
import styles from './Charts.module.css'
import radio from '../../styles/radio.module.css'

const ALL_SOURCES: ChartDataSource[] = [
  'entry-count',
  'page-count',
  'feedback-by-type',
  'feedback-by-dimension',
  'feedback-over-time',
  'feedback-per-page',
]

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

// ---- Dropdown panel rendered in a portal to escape modal overflow ----

function DropdownPanel({ anchorRef, children }: { anchorRef: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    function update() {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [anchorRef])

  if (!pos) return null

  return createPortal(
    <div className={styles.scopePanel} data-dropdown-panel style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}>
      {children}
    </div>,
    document.body,
  )
}

// ---- Component ----

interface AddChartModalProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string, dataSource: ChartDataSource, chartType: ChartType, scopes?: ChartScope[], propertyId?: number) => void
  editing?: ChartConfig
  onUpdate?: (id: number, name: string, dataSource: ChartDataSource, chartType: ChartType, scopes?: ChartScope[], propertyId?: number) => void
  pageId: number
  allPages: Page[]
}

export function AddChartModal({ open, onClose, onAdd, editing, onUpdate, pageId, allPages }: AddChartModalProps) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ChartScope[]>([])
  const [source, setSource] = useState<ChartDataSource>(editing?.dataSource ?? 'entry-count')
  const [type, setType] = useState<ChartType>(editing?.chartType ?? 'bar')
  const [propertyId, setPropertyId] = useState<number | undefined>(editing?.propertyId)
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

  // Build scope options: grouped tree — "This page", main-timeline, hubs with children, standalone pages
  const scopeOptions = useMemo<ScopeOption[]>(() => {
    const opts: ScopeOption[] = [
      { label: 'This page', scope: { type: 'page', pageId }, key: `page-${pageId}` },
    ]
    // Main timeline (if not the current page)
    const mainTimeline = allPages.find((p) => p.role === 'main-timeline' && p.id !== pageId)
    if (mainTimeline) {
      opts.push({ label: mainTimeline.name, scope: { type: 'page', pageId: mainTimeline.id! }, key: `page-${mainTimeline.id}` })
    }
    // Hubs with their children indented underneath
    for (const hub of allPages) {
      if (hub.type !== 'hub') continue
      opts.push({ label: hub.name, scope: { type: 'hub', hubId: hub.id! }, key: `hub-${hub.id}` })
      const children = allPages.filter((p) => p.parentId === hub.id && p.type !== 'candidate')
      for (const child of children) {
        if (child.id === pageId) continue
        opts.push({ label: child.name, scope: { type: 'page', pageId: child.id! }, key: `page-${child.id}`, isChild: true })
      }
    }
    // Standalone root pages (not hubs, no parent, not main-timeline, not current page)
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
    // Don't close if clicking inside a portaled dropdown panel
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

  // Summary text for the scope trigger
  const scopeSummary = useMemo(() => {
    if (scopes.length === 0) return 'All'
    if (scopes.length === 1) {
      const match = scopeOptions.find((o) => scopesEqual(o.scope, scopes[0]))
      return match?.label ?? '1 selected'
    }
    return `${scopes.length} selected`
  }, [scopes, scopeOptions])

  // Reset form when modal opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      setScopeOpen(false)
      setSourceOpen(false)
      if (editing) {
        setName(editing.name ?? '')
        setScopes(editing.scopes ?? [])
        setSource(editing.dataSource)
        setType(editing.chartType)
        setPropertyId(editing.propertyId)
        userEditedName.current = true
      } else {
        setName(DATA_SOURCE_LABELS['entry-count'] ?? '')
        const currentPage = allPages.find((p) => p.id === pageId)
        const defaultScope: ChartScope[] = currentPage?.type === 'hub'
          ? [{ type: 'hub', hubId: pageId }]
          : [{ type: 'page', pageId }]
        setScopes(defaultScope)
        setSource('entry-count')
        setType('bar')
        setPropertyId(undefined)
        userEditedName.current = false
      }
    }
    prevOpen.current = open
  }, [open, editing, allPages, pageId])

  const validTypes = VALID_CHART_TYPES[source] ?? (['bar'] as ChartType[])
  const effectiveType = validTypes.includes(type) ? type : validTypes[0]

  function handleConfirm() {
    const chartName = name.trim() || (DATA_SOURCE_LABELS[source] ?? 'Chart')
    const scopesValue = scopes.length > 0 ? scopes : undefined
    const propId = source === 'property-distribution' ? propertyId : undefined
    if (editing && onUpdate) {
      onUpdate(editing.id!, chartName, source, effectiveType, scopesValue, propId)
    } else {
      onAdd(chartName, source, effectiveType, scopesValue, propId)
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
            >
              <span>{scopeSummary}</span>
              <svg className={scopeOpen ? styles.scopeChevronOpen : styles.scopeChevron} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 13.0729L7.42708 8.5L5.92708 10L12 16.0729L18.0729 10L16.5729 8.5L12 13.0729Z" fill="currentColor" />
              </svg>
            </button>
            {scopeOpen && (
              <DropdownPanel anchorRef={scopeTriggerRef}>
                {scopeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={opt.isChild ? `${styles.scopeOption} ${styles.scopeOptionChild}` : styles.scopeOption}
                    onClick={() => setScopes(toggleScope(scopes, opt.scope))}
                    type="button"
                  >
                    <div
                      className={styles.scopeCheckbox}
                      data-checked={isScopeSelected(scopes, opt.scope)}
                    />
                    {opt.label}
                  </button>
                ))}
              </DropdownPanel>
            )}
          </div>
        </div>

        {/* Data source — unified dropdown (built-in + hub properties) */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Data source</span>
          <div className={styles.scopeDropdown} ref={sourceRef}>
            <button
              className={styles.scopeTrigger}
              onClick={() => setSourceOpen((v) => !v)}
              type="button"
              ref={sourceTriggerRef}
              aria-expanded={sourceOpen}
            >
              <span>{source === 'property-distribution'
                ? (pageProperties.find((p: HubProperty) => p.id === propertyId)?.name ?? 'Select property...')
                : DATA_SOURCE_LABELS[source]}</span>
              <svg className={sourceOpen ? styles.scopeChevronOpen : styles.scopeChevron} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 13.0729L7.42708 8.5L5.92708 10L12 16.0729L18.0729 10L16.5729 8.5L12 13.0729Z" fill="currentColor" />
              </svg>
            </button>
            {sourceOpen && (
              <DropdownPanel anchorRef={sourceTriggerRef}>
                {ALL_SOURCES.map((s) => (
                  <button
                    key={s}
                    className={styles.scopeOption}
                    onClick={() => { setSource(s); setPropertyId(undefined); setSourceOpen(false); if (!userEditedName.current) setName(DATA_SOURCE_LABELS[s] ?? '') }}
                    type="button"
                  >
                    <div
                      className={styles.scopeRadio}
                      data-checked={source === s && !propertyId}
                    />
                    {DATA_SOURCE_LABELS[s]}
                  </button>
                ))}
                {pageProperties.length > 0 && pageProperties.map((prop: HubProperty) => {
                  const hub = allPages.find((p) => p.id === prop.hubId)
                  return (
                    <button
                      key={`prop-${prop.id}`}
                      className={styles.scopeOption}
                      onClick={() => { setSource('property-distribution'); setPropertyId(prop.id); setSourceOpen(false); if (!userEditedName.current) setName(prop.name ?? '') }}
                      type="button"
                    >
                      <div
                        className={styles.scopeRadio}
                        data-checked={source === 'property-distribution' && propertyId === prop.id}
                      />
                      {hub ? `${hub.name} — ${prop.name}` : prop.name}
                    </button>
                  )
                })}
              </DropdownPanel>
            )}
          </div>
        </div>

        {/* Chart type */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Chart type</span>
          <div className={styles.radioRow}>
            {validTypes.map((t) => (
              <button key={t} className={radio.radioOption} onClick={() => setType(t)}>
                <div className={radio.radioCircle} data-checked={effectiveType === t} />
                {CHART_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
