import { useState, useRef, useEffect, memo } from 'react'
import type { HubProperty } from '../../types'
import styles from './PropertyRow.module.css'

interface PropertyRowProps {
  property: HubProperty
  value?: string
  onChange: (value: string) => void
}

export const PropertyRow = memo(function PropertyRow({ property, value, onChange }: PropertyRowProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedOption = property.options.find((o) => o.value === value)

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        {selectedOption ? (
          <>
            <span className={styles.dot} style={{ background: selectedOption.color }} />
            {selectedOption.label}
          </>
        ) : (
          <span className={styles.placeholder}>{property.name}</span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 13.0729L7.42708 8.5L5.92708 10L12 16.0729L18.0729 10L16.5729 8.5L12 13.0729Z" fill="currentColor" fillOpacity="0.7" />
        </svg>
      </button>
      {open && (
        <div className={styles.menu}>
          {property.options.map((option) => (
            <button
              key={option.value}
              className={styles.menuItem}
              data-active={option.value === value || undefined}
              onClick={() => { onChange(option.value); setOpen(false) }}
            >
              <span className={styles.dot} style={{ background: option.color }} />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
