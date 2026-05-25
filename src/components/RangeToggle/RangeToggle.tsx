import { Fragment } from 'react'
import styles from './RangeToggle.module.css'

export type RangeMonths = 0 | 3 | 6 | 12

const RANGE_OPTIONS: RangeMonths[] = [3, 6, 12, 0]
const RANGE_LABELS: Record<RangeMonths, string> = { 3: '3M', 6: '6M', 12: '12M', 0: 'All' }

interface RangeToggleProps {
  value: RangeMonths
  onChange: (range: RangeMonths) => void
}

export function RangeToggle({ value, onChange }: RangeToggleProps) {
  return (
    <div className={styles.rangeToggle}>
      {RANGE_OPTIONS.map((r, i) => (
        <Fragment key={r}>
          {i > 0 && <div className={styles.rangeSeparator} />}
          <button
            className={value === r ? styles.rangeButtonActive : styles.rangeButton}
            onClick={() => onChange(r)}
          >
            {RANGE_LABELS[r]}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
