import { useState, useEffect, useRef } from 'react'
import { Modal } from '../Modal/Modal'
import { DATA_SOURCE_LABELS, VALID_CHART_TYPES } from './ChartRenderer'
import type { ChartDataSource, ChartType, ChartConfig, ChartScope, Page } from '../../types'
import styles from './Charts.module.css'
import radio from '../../styles/radio.module.css'

const ALL_SOURCES: ChartDataSource[] = [
  'entry-count', 'ticket-breakdown', 'ticketed-ratio',
  'feedback-sentiment', 'feedback-by-dimension',
  'candidate-status',
]

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar', line: 'Line', area: 'Area', pie: 'Pie',
}

function scopeToValue(scope: ChartScope): string {
  if (scope.type === 'global') return 'global'
  if (scope.type === 'page') return 'page'
  return `hub-${scope.hubId}`
}

function valueToScope(value: string, pageId: number): ChartScope {
  if (value === 'global') return { type: 'global' }
  if (value === 'page') return { type: 'page', pageId }
  return { type: 'hub', hubId: Number(value.replace('hub-', '')) }
}

interface AddChartModalProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string, dataSource: ChartDataSource, chartType: ChartType, scope?: ChartScope) => void
  editing?: ChartConfig
  onUpdate?: (id: number, name: string, dataSource: ChartDataSource, chartType: ChartType, scope?: ChartScope) => void
  pageId: number
  hubPages: Page[]
}

export function AddChartModal({ open, onClose, onAdd, editing, onUpdate, pageId, hubPages }: AddChartModalProps) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState<ChartScope>(editing?.scope ?? { type: 'global' })
  const [source, setSource] = useState<ChartDataSource>(editing?.dataSource ?? 'entry-count')
  const [type, setType] = useState<ChartType>(editing?.chartType ?? 'bar')
  const prevOpen = useRef(false)
  const userEditedName = useRef(false)

  // Reset form when modal opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      if (editing) {
        setName(editing.name ?? '')
        setScope(editing.scope ?? { type: 'global' })
        setSource(editing.dataSource)
        setType(editing.chartType)
        userEditedName.current = true
      } else {
        setName(DATA_SOURCE_LABELS['entry-count'] ?? '')
        setScope({ type: 'global' })
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
    if (editing && onUpdate) {
      onUpdate(editing.id!, chartName, source, effectiveType, scope)
    } else {
      onAdd(chartName, source, effectiveType, scope)
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

        {/* Scope */}
        <div className={styles.formSection}>
          <span className={styles.formLabel}>Scope</span>
          <select
            className={styles.formSelect}
            value={scopeToValue(scope)}
            onChange={(e) => setScope(valueToScope(e.target.value, pageId))}
          >
            <option value="global">All</option>
            <option value="page">This page</option>
            {hubPages.map((h) => (
              <option key={h.id} value={`hub-${h.id}`}>{h.name}</option>
            ))}
          </select>
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
