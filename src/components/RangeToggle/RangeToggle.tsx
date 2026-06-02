import { Fragment, useRef, useCallback } from 'react'
import styles from './RangeToggle.module.css'

export type RangeMonths = 0 | 3 | 6 | 12

const RANGE_OPTIONS: RangeMonths[] = [3, 6, 12, 0]
const RANGE_LABELS: Record<RangeMonths, string> = { 3: '3M', 6: '6M', 12: '12M', 0: 'All' }

interface RangeToggleProps {
  value: RangeMonths
  onChange: (range: RangeMonths) => void
}

export function RangeToggle({ value, onChange }: RangeToggleProps) {
  const groupRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' &&
        e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const currentIndex = RANGE_OPTIONS.indexOf(value)
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? (currentIndex + 1) % RANGE_OPTIONS.length
      : (currentIndex - 1 + RANGE_OPTIONS.length) % RANGE_OPTIONS.length
    onChange(RANGE_OPTIONS[next])
    const buttons = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')
    buttons?.[next]?.focus()
  }, [value, onChange])

  return (
    <div ref={groupRef} className={styles.rangeToggle} role="radiogroup" aria-label="Time range" onKeyDown={handleKeyDown}>
      {RANGE_OPTIONS.map((r, i) => (
        <Fragment key={r}>
          {i > 0 && <div className={styles.rangeSeparator} />}
          <button
            className={value === r ? styles.rangeButtonActive : styles.rangeButton}
            onClick={() => onChange(r)}
            role="radio"
            aria-checked={value === r}
            tabIndex={value === r ? 0 : -1}
          >
            {RANGE_LABELS[r]}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
