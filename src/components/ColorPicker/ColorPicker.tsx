import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './ColorPicker.module.css'

interface ColorPickerProps {
  colors: string[]
  value?: string
  onChange: (color: string) => void
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function ColorPicker({ colors, value, onChange, onClose, anchorRef }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = value ? colors.indexOf(value) : -1
    return idx >= 0 ? idx : 0
  })

  // Position relative to anchor element
  useEffect(() => {
    function update() {
      const el = anchorRef?.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorRef])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Auto-focus picker on mount
  useEffect(() => {
    ref.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        setActiveIndex((prev) => (prev < colors.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowLeft':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : colors.length - 1))
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 5, colors.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 5, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (activeIndex >= 0) {
          onChange(colors[activeIndex])
          onClose()
          anchorRef?.current?.focus()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        anchorRef?.current?.focus()
        break
    }
  }

  const content = (
    <div
      ref={ref}
      className={styles.picker}
      style={pos ? { position: 'fixed', top: pos.top, left: pos.left } : undefined}
      tabIndex={-1}
      role="listbox"
      aria-label="Pick a color"
      onKeyDown={handleKeyDown}
    >
      {colors.map((color, i) => (
        <button
          key={color}
          className={color === value ? styles.swatchActive : styles.swatch}
          style={{ background: color }}
          onClick={() => { onChange(color); onClose(); anchorRef?.current?.focus() }}
          aria-label={color}
          role="option"
          aria-selected={color === value}
          tabIndex={i === activeIndex ? 0 : -1}
        />
      ))}
    </div>
  )

  // If we have an anchor, render in a portal to escape modal overflow
  if (anchorRef) {
    return pos ? createPortal(content, document.body) : null
  }

  // Fallback: render inline (legacy behavior)
  return content
}
