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

  const content = (
    <div
      ref={ref}
      className={styles.picker}
      style={pos ? { position: 'fixed', top: pos.top, left: pos.left } : undefined}
    >
      {colors.map((color) => (
        <button
          key={color}
          className={color === value ? styles.swatchActive : styles.swatch}
          style={{ background: color }}
          onClick={() => { onChange(color); onClose() }}
          aria-label={color}
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
