import React, { useState, useMemo } from 'react'
import { EmptyState } from '../EmptyState/EmptyState'
import { ChartRenderer, DATA_SOURCE_LABELS } from './ChartRenderer'
import { AddChartModal } from './AddChartModal'
import { useChartConfigs, addChartConfig, updateChartConfig, deleteChartConfig } from '../../hooks/useChartConfigs'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useAllEntries, useAllFeedbacks } from '../../hooks/useChartData'
import { useDimensions } from '../../hooks/useDimensions'
import type { ChartConfig, ChartDataSource, ChartType, ChartScope, TimelineEntry, Feedback, Page, Dimension } from '../../types'
import styles from './Charts.module.css'

type RangeMonths = 3 | 6 | 12
const RANGE_OPTIONS: RangeMonths[] = [3, 6, 12]
const RANGE_LABELS: Record<RangeMonths, string> = { 3: '3M', 6: '6M', 12: '12M' }

interface ConfigurableVizProps {
  blockId: number
  pageId: number
}

export function ConfigurableViz({ blockId, pageId }: ConfigurableVizProps) {
  const configs = useChartConfigs(blockId)
  const { allPages } = useAutocomplete()
  const allEntries = useAllEntries()
  const allFeedbacks = useAllFeedbacks()
  const dimensions = useDimensions()
  const [range, setRangeState] = useState<RangeMonths>(() => {
    const stored = localStorage.getItem(`viz-range-${blockId}`)
    return stored === '3' ? 3 : stored === '6' ? 6 : 12
  })
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ChartConfig | undefined>()

  function setRange(r: RangeMonths) {
    setRangeState(r)
    localStorage.setItem(`viz-range-${blockId}`, String(r))
  }

  const hubPages = useMemo(() =>
    allPages.filter((p) => p.type === 'hub'),
    [allPages]
  )

  async function handleAdd(name: string, dataSource: ChartDataSource, chartType: ChartType, scope?: ChartScope) {
    await addChartConfig(blockId, name, dataSource, chartType, scope)
  }

  async function handleUpdate(id: number, name: string, dataSource: ChartDataSource, chartType: ChartType, scope?: ChartScope) {
    await updateChartConfig(id, { name, dataSource, chartType, scope })
  }

  async function handleDelete(id: number) {
    await deleteChartConfig(id)
  }

  const rows = buildRows(configs)

  return (
    <div className={styles.vizPage}>
      {/* ---- Controls ---- */}
      <div className={styles.vizControls}>
        <div className={styles.rangeToggle}>
          {RANGE_OPTIONS.map((r, i) => (
            <React.Fragment key={r}>
              {i > 0 && <div className={styles.rangeSeparator} />}
              <button
                className={range === r ? styles.rangeButtonActive : styles.rangeButton}
                onClick={() => setRange(r)}
              >
                {RANGE_LABELS[r]}
              </button>
            </React.Fragment>
          ))}
        </div>
        <button className={styles.chartEditBtn} onClick={() => setAddOpen(true)} aria-label="Add chart">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M7.25 8.75V14H8.75V8.75H14V7.25H8.75V2H7.25V7.25H2V8.75H7.25Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* ---- Charts ---- */}
      {configs.length === 0 ? (
        <EmptyState message="No charts yet" />
      ) : (
        rows.map((row, i) => {
          if (row.type === 'pair') {
            return (
              <div key={i} className={styles.chartPair}>
                <div className={styles.chartPairLeft}>
                  <ChartCard config={row.time!} monthCount={range} entries={allEntries} feedbacks={allFeedbacks} pages={allPages} dimensions={dimensions} onEdit={setEditing} onDelete={handleDelete} />
                </div>
                <div className={styles.chartPairRight}>
                  <ChartCard config={row.pie!} monthCount={range} entries={allEntries} feedbacks={allFeedbacks} pages={allPages} dimensions={dimensions} onEdit={setEditing} onDelete={handleDelete} isPie />
                </div>
              </div>
            )
          }
          return (
            <div key={i} className={styles.chartSection}>
              <ChartCard config={row.config!} monthCount={range} entries={allEntries} feedbacks={allFeedbacks} pages={allPages} dimensions={dimensions} onEdit={setEditing} onDelete={handleDelete} />
            </div>
          )
        })
      )}

      <AddChartModal
        open={addOpen || !!editing}
        onClose={() => { setAddOpen(false); setEditing(undefined) }}
        onAdd={handleAdd}
        editing={editing}
        onUpdate={handleUpdate}
        pageId={pageId}
        hubPages={hubPages}
      />
    </div>
  )
}

// ---- Chart card ----

function ChartCard({
  config,
  monthCount,
  entries,
  feedbacks,
  pages,
  dimensions,
  onEdit,
  onDelete,
  isPie,
}: {
  config: ChartConfig
  monthCount: 3 | 6 | 12
  entries: TimelineEntry[]
  feedbacks: Feedback[]
  pages: Page[]
  dimensions: Dimension[]
  onEdit: (c: ChartConfig) => void
  onDelete: (id: number) => void
  isPie?: boolean
}) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartCardHeader}>
        <span className={styles.chartTitle}>{config.name || DATA_SOURCE_LABELS[config.dataSource]}</span>
        <div className={styles.chartCardActions}>
          <button className={styles.chartEditBtn} onClick={() => onEdit(config)} aria-label="Edit chart">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.94 3.002C11.525 2.416 12.475 2.416 13.06 3.002L15 4.941C15.586 5.527 15.586 6.477 15 7.062L7.061 15.002H3V10.941L10.94 3.002ZM4.5 11.562V13.502H6.439L11.315 8.627L9.375 6.687L4.5 11.562ZM10.435 5.627L12.375 7.566L13.94 6.002L12 4.062L10.435 5.627Z" fill="currentColor" />
            </svg>
          </button>
          <button className={styles.chartDeleteBtn} onClick={() => onDelete(config.id!)} aria-label="Delete chart">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <ChartRenderer
        config={config}
        monthCount={monthCount}
        entries={entries}
        feedbacks={feedbacks}
        pages={pages}
        dimensions={dimensions}
        containerClass={isPie ? styles.chartContainerPie : styles.chartContainer}
      />
    </div>
  )
}

// ---- Auto-pairing logic ----

type ChartRow =
  | { type: 'pair'; time: ChartConfig; pie: ChartConfig }
  | { type: 'single'; config: ChartConfig }

function buildRows(configs: ChartConfig[]): ChartRow[] {
  const rows: ChartRow[] = []
  const used = new Set<number>()

  const timeSources = new Set(['entry-count', 'feedback-sentiment'])

  for (const c of configs) {
    if (used.has(c.id!)) continue
    if (c.chartType !== 'pie' && timeSources.has(c.dataSource)) {
      const pie = configs.find((p) =>
        p.id !== c.id && !used.has(p.id!) && p.chartType === 'pie' && p.dataSource === c.dataSource
      )
      if (pie) {
        rows.push({ type: 'pair', time: c, pie })
        used.add(c.id!)
        used.add(pie.id!)
        continue
      }
    }
  }

  for (const c of configs) {
    if (!used.has(c.id!)) {
      rows.push({ type: 'single', config: c })
    }
  }

  return rows
}
