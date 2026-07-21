import { useRegexPatterns, useHubAssignedPatternIds, assignPatternToHub, unassignPatternFromHub } from '../../hooks/useRegexPatterns'
import { useToast } from '../../hooks/useToast'
import styles from './PropertyEditor.module.css'

export function RegexPatternAssignment({ pageId }: { pageId: number }) {
  const regexPatterns = useRegexPatterns()
  const assignedPatternIds = useHubAssignedPatternIds(pageId)
  const { show: showToast } = useToast()

  if (regexPatterns.length === 0) return null

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>Regex Patterns</span>
      </div>

      <div className={styles.propertyList}>
        {regexPatterns.map((rp) => {
          const isAssigned = assignedPatternIds.has(rp.id!)
          return (
            <div
              key={rp.id}
              className={styles.metricRow}
              onClick={() => {
                if (isAssigned) unassignPatternFromHub(pageId, rp.id!).catch(() => showToast('Failed to update'))
                else assignPatternToHub(pageId, rp.id!).catch(() => showToast('Failed to update'))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (isAssigned) unassignPatternFromHub(pageId, rp.id!).catch(() => showToast('Failed to update'))
                  else assignPatternToHub(pageId, rp.id!).catch(() => showToast('Failed to update'))
                }
              }}
              role="checkbox"
              aria-checked={isAssigned}
              tabIndex={0}
            >
              <div className={styles.metricCheckbox} data-checked={isAssigned} />
              <span className={styles.metricLabel}>{rp.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
