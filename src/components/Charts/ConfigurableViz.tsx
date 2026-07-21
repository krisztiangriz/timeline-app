import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { EmptyState } from '../EmptyState/EmptyState'
import { CloseIcon } from '../Icons/Icons'
import { RangeToggle, type RangeMonths } from '../RangeToggle/RangeToggle'
import { ChartRenderer, SOURCE_LABELS } from './ChartRenderer'
import { AddChartModal } from './AddChartModal'
import { useChartConfigs, addChartConfig, updateChartConfig, deleteChartConfig } from '../../hooks/useChartConfigs'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useAllEntries } from '../../hooks/useChartData'
import { useChartPalette } from '../../hooks/useChartPalette'
import { useRegexPatterns } from '../../hooks/useRegexPatterns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/database'
import type { ChartConfig, ChartSource, ChartGrouping, ChartType, ChartScope, TimelineEntry, Page, HubProperty, PagePropertyValue, RegexPattern } from '../../types'
import { useOnboardingActions } from '../../hooks/useOnboardingGuides'
import { OnboardingGuide } from '../OnboardingGuide/OnboardingGuide'
import { safeGetItem, safeSetItem } from '../../utils/safeStorage'
import { useToast } from '../../hooks/useToast'
import styles from './Charts.module.css'

interface ConfigurableVizProps {
  blockId: number
  pageId: number
}

export const ConfigurableViz = memo(function ConfigurableViz({ blockId, pageId }: ConfigurableVizProps) {
  const configs = useChartConfigs(blockId)
  const { allPages } = useAutocomplete()
  const { show: showToast } = useToast()
  const { palette } = useChartPalette()
  const [range, setRangeState] = useState<RangeMonths>(() => {
    const stored = safeGetItem(`viz-range-${blockId}`)
    return stored === '0' ? 0 : stored === '3' ? 3 : stored === '6' ? 6 : 12
  })
  const allEntries = useAllEntries(range || undefined)

  // Scope hub/property queries to hub IDs referenced by configs
  const relevantHubIds = useMemo(() => {
    const ids = new Set<number>()
    for (const c of configs) {
      for (const s of c.scopes ?? []) {
        if (s.type === 'hub') ids.add(s.hubId)
        if (s.type === 'page') {
          const page = allPages.find((p) => p.id === s.pageId)
          if (page?.type === 'hub') ids.add(s.pageId)
          else if (page?.parentId) ids.add(page.parentId)
        }
      }
    }
    const currentPage = allPages.find((p) => p.id === pageId)
    if (currentPage?.type === 'hub') ids.add(pageId)
    else if (currentPage?.parentId) ids.add(currentPage.parentId)
    else ids.add(pageId)
    return [...ids]
  }, [configs, pageId, allPages])

  const allHubProperties = useLiveQuery(
    () => relevantHubIds.length > 0
      ? db.hubProperties.where('hubId').anyOf(relevantHubIds).toArray()
      : db.hubProperties.toArray(),
    [relevantHubIds.join(',')]
  ) ?? []

  const relevantPageIds = useMemo(
    () => allPages.filter((p) => p.parentId && relevantHubIds.includes(p.parentId)).map((p) => p.id!),
    [allPages, relevantHubIds]
  )

  const allPropertyValues = useLiveQuery(
    () => relevantPageIds.length > 0
      ? db.pagePropertyValues.where('pageId').anyOf(relevantPageIds).toArray()
      : db.pagePropertyValues.toArray(),
    [relevantPageIds.join(',')]
  ) ?? []

  const allRegexPatterns = useRegexPatterns()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ChartConfig | undefined>()

  // Onboarding
  const { triggerGuide } = useOnboardingActions()
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const isEmpty = configs.length === 0
  useEffect(() => { if (isEmpty) triggerGuide('visualization-charts') }, [isEmpty, triggerGuide])

  function setRange(r: RangeMonths) {
    setRangeState(r)
    safeSetItem(`viz-range-${blockId}`, String(r))
  }

  async function handleAdd(name: string, source: ChartSource, grouping: ChartGrouping, chartType: ChartType, scopes?: ChartScope[], propertyId?: number, aggregateByHub?: boolean, regexPatternIds?: number[]) {
    try { await addChartConfig(blockId, name, source, grouping, chartType, scopes, propertyId, aggregateByHub, regexPatternIds) } catch { showToast('Failed to add chart') }
  }

  async function handleUpdate(id: number, name: string, source: ChartSource, grouping: ChartGrouping, chartType: ChartType, scopes?: ChartScope[], propertyId?: number, aggregateByHub?: boolean, regexPatternIds?: number[]) {
    try { await updateChartConfig(id, { name, source, grouping, chartType, scopes, propertyId, aggregateByHub, regexPatternIds }) } catch { showToast('Failed to update chart') }
  }

  async function handleDelete(id: number) {
    try { await deleteChartConfig(id) } catch { showToast('Failed to delete chart') }
  }


  return (
    <div className={styles.vizPage}>
      {/* ---- Controls ---- */}
      <div className={styles.vizControls}>
        <RangeToggle value={range} onChange={setRange} />
        <button ref={addBtnRef} className={styles.chartEditBtn} onClick={() => setAddOpen(true)} aria-label="Add chart">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M7.25 8.75V14H8.75V8.75H14V7.25H8.75V2H7.25V7.25H2V8.75H7.25Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* ---- Charts ---- */}
      {configs.length === 0 ? (
        <EmptyState message="Add a chart to visualize your data" />
      ) : (
        configs.map((config) => (
          <div key={config.id} className={styles.chartSection}>
            <ChartCard config={config} monthCount={range} entries={allEntries} pages={allPages} hubProperties={allHubProperties} propertyValues={allPropertyValues} regexPatterns={allRegexPatterns} onEdit={setEditing} onDelete={handleDelete} isPie={config.chartType === 'pie'} palette={palette} />
          </div>
        ))
      )}

      <OnboardingGuide guideId="visualization-charts" anchorRef={addBtnRef} position="bottom-right" />
      <AddChartModal
        open={addOpen || !!editing}
        onClose={() => { setAddOpen(false); setEditing(undefined) }}
        onAdd={handleAdd}
        editing={editing}
        onUpdate={handleUpdate}
        pageId={pageId}
        allPages={allPages}
      />
    </div>
  )
})

// ---- Chart card ----

const ChartCard = memo(function ChartCard({
  config,
  monthCount,
  entries,
  pages,
  hubProperties,
  propertyValues,
  regexPatterns,
  onEdit,
  onDelete,
  isPie,
  palette,
}: {
  config: ChartConfig
  monthCount: 0 | 3 | 6 | 12
  entries: TimelineEntry[]
  pages: Page[]
  hubProperties: HubProperty[]
  propertyValues: PagePropertyValue[]
  regexPatterns: RegexPattern[]
  onEdit: (c: ChartConfig) => void
  onDelete: (id: number) => void
  isPie?: boolean
  palette: string[]
}) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartCardHeader}>
        <span className={styles.chartTitle}>{config.name || SOURCE_LABELS[config.source]}</span>
        <div className={styles.chartCardActions}>
          <button className={styles.chartEditBtn} onClick={() => onEdit(config)} aria-label="Edit chart">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.94 3.002C11.525 2.416 12.475 2.416 13.06 3.002L15 4.941C15.586 5.527 15.586 6.477 15 7.062L7.061 15.002H3V10.941L10.94 3.002ZM4.5 11.562V13.502H6.439L11.315 8.627L9.375 6.687L4.5 11.562ZM10.435 5.627L12.375 7.566L13.94 6.002L12 4.062L10.435 5.627Z" fill="currentColor" />
            </svg>
          </button>
          <button className={styles.chartDeleteBtn} onClick={() => onDelete(config.id!)} aria-label="Delete chart">
            <CloseIcon />
          </button>
        </div>
      </div>
      <ChartRenderer
        config={config}
        monthCount={monthCount}
        entries={entries}
        pages={pages}
        hubProperties={hubProperties}
        propertyValues={propertyValues}
        regexPatterns={regexPatterns}
        containerClass={isPie ? styles.chartContainerPie : styles.chartContainer}
        palette={palette}
      />
    </div>
  )
})
