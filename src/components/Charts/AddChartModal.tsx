import { useState, useEffect, useRef, useMemo } from 'react'
import { Modal } from '../Modal/Modal'
import { DATA_SOURCE_LABELS, VALID_CHART_TYPES } from './ChartRenderer'
import { resolveScopes } from '../../hooks/useChartConfigs'
import type { ChartDataSource, ChartType, ChartConfig, ChartScope, Page } from '../../types'
import styles from './Charts.module.css'
import radio from '../../styles/radio.module.css'

const ALL_SOURCES: ChartDataSource[] = [
  'entry-count', 'feedback-sentiment',
  'feedback-by-dimension', 'candidate-status',
]

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar', line: 'Line', area: 'Area', pie: 'Pie',
}

// ---- Scope helpers ----

interface ScopeOption {
  label: string
  scope: ChartScope
  key: string
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
  onAdd: (name: string, dataSource: ChartDataSource, chartType: ChartType, scopes?: ChartScope[]) => void
  editing?: ChartConfig
  onUpdate?: (id: number, name: string, dataSource: ChartDataSource, chartType: ChartType, scopes?: ChartScope[]) => void
  pageId: number
  allPages: Page[]
}

export function AddChartModal({ open, onClose, onAdd, editing, onUpdate, pageId, allPages }: AddChartModalProps) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ChartScope[]>([])
  const [source, setSource] = useState<ChartDataSource>(editing?.dataSource ?? 'entry-count')
  const [type, setType] = useState<ChartType>(editing?.chartType ?? 'bar')
  const prevOpen = useRef(false)
  const userEditedName = useRef(false)

  // Build scope options: "This page" + hubs + standalone root pages (no parentId, not hub, not this page)
  const scopeOptions = useMemo<ScopeOption[]>(() => {
    const opts: ScopeOption[] = [
      { label: 'This page', scope: { type: 'page', pageId }, key: `page-${pageId}` },
    ]
    // Hubs
    for (const p of allPages) {
      if (p.type === 'hub') {
        opts.push({ label: p.name, scope: { type: 'hub', hubId: p.id! }, key: `hub-${p.id}` })
      }
    }
    // Standalone root pages (not hubs, no parent, not the current page)
    for (const p of allPages) {
      if (p.type !== 'hub' && !p.parentId && p.id !== pageId && p.role !== 'main-timeline') {
        opts.push({ label: p.name, scope: { type: 'page', pageId: p.id! }, key: `page-${p.id}` })
      }
    }
    return opts
  }, [allPages, pageId])

  // Reset form when modal opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      if (editing) {
        setName(editing.name ?? '')
        setScopes(resolveScopes(editing))
        setSource(editing.dataSource)
        setType(editing.chartType)
        userEditedName.current = true
      } else {
        setName(DATA_SOURCE_LABELS['entry-count'] ?? '')
        setScopes([])
        setSource('entry-count')
        setType('bar')
        userEditedName.current = false
      }
    }
    prevOpen.current = open
  }, [open, editing])

  // Auto-fill name from data source label when source changes (only if user hasn't customized it)
  useEffect(() => {
    if (!userEditedName.current) {
      setName(DATA_SOURCE_LABELS[source] ?? '')
    }
  }, [source])

  const validTypes = VALID_CHART_TYPES[source] ?? (['bar'] as ChartType[])
  const effectiveType = validTypes.includes(type) ? type : validTypes[0]

  function handleConfirm() {
    const chartName = name.trim() || (DATA_SOURCE_LABELS[source] ?? 'Chart')
    const scopesValue = scopes.length > 0 ? scopes : undefined
    if (editing && onUpdate) {
      onUpdate(editing.id!, chartName, source, effectiveType, scopesValue)
    } else {
      onAdd(chartName, source, effectiveType, scopesValue)
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

        {/* Scope — multi-select checkboxes */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Scope</span>
          <span className={styles.scopeHint}>None selected = all data</span>
          <div className={styles.scopeList}>
            {scopeOptions.map((opt) => (
              <button
                key={opt.key}
                className={styles.scopeOption}
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
          </div>
        </div>

        {/* Data source */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Data source</span>
          <select
            className={styles.formSelect}
            value={source}
            onChange={(e) => setSource(e.target.value as ChartDataSource)}
          >
            {ALL_SOURCES.map((s) => (
              <option key={s} value={s}>{DATA_SOURCE_LABELS[s]}</option>
            ))}
          </select>
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
