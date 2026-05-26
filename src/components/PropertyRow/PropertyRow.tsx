import { useState, useRef, useEffect, useCallback, memo } from 'react'
import type { HubProperty } from '../../types'
import styles from './PropertyRow.module.css'

interface PropertyRowProps {
  property: HubProperty
  value?: string
  onChange: (value: string) => void
}

export const PropertyRow = memo(function PropertyRow({ property, value, onChange }: PropertyRowProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  // Focus active item when activeIndex changes
  useEffect(() => {
    if (!open || activeIndex < 0 || !menuRef.current) return
    const buttons = menuRef.current.querySelectorAll<HTMLElement>('[role="option"]')
    buttons[activeIndex]?.focus()
  }, [open, activeIndex])

  const handleOpen = useCallback(() => {
    setOpen(true)
    // Set activeIndex to currently selected option
    const idx = property.options.findIndex((o) => o.value === value)
    setActiveIndex(idx >= 0 ? idx : 0)
  }, [property.options, value])

  const handleClose = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
    triggerRef.current?.focus()
  }, [])

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpen()
    }
  }

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < property.options.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : property.options.length - 1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (activeIndex >= 0) {
          onChange(property.options[activeIndex].value)
          handleClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        handleClose()
        break
    }
  }

  const selectedOption = property.options.find((o) => o.value === value)

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        onClick={() => open ? handleClose() : handleOpen()}
        onKeyDown={handleTriggerKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={property.name}
      >
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
        <div className={styles.menu} role="listbox" ref={menuRef} onKeyDown={handleMenuKeyDown}>
          {property.options.map((option, i) => (
            <button
              key={option.value}
              className={styles.menuItem}
              data-active={option.value === value || undefined}
              onClick={() => { onChange(option.value); handleClose() }}
              role="option"
              aria-selected={option.value === value}
              tabIndex={i === activeIndex ? 0 : -1}
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
