import { createPortal } from 'react-dom'
import { useLayoutEffect, useState, useEffect, useCallback, useRef, type ReactNode, type RefObject } from 'react'
import styles from './DropdownPortal.module.css'

interface DropdownPortalProps {
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  open: boolean
  onClose?: () => void
  /** When true, focuses the first focusable item on open and traps Tab within the portal */
  autoFocus?: boolean
}

/**
 * Renders children in a portal (document.body) positioned below the anchor element.
 * Escapes any overflow clipping from parent containers (modals, scroll areas).
 * Re-measures on scroll and resize to stay aligned with the anchor.
 * When onClose is provided, renders an invisible backdrop that closes the dropdown on click.
 * When autoFocus is true, focuses first item on open and traps Tab/Escape within the portal.
 */
export function DropdownPortal({ anchorRef, children, open, onClose, autoFocus }: DropdownPortalProps) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const portalRef = useRef<HTMLDivElement>(null)

  const measure = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [anchorRef])

  useLayoutEffect(() => {
    if (open) measure()
  }, [open, measure])

  // Re-measure on any scroll or resize (follows modal body scroll)
  useEffect(() => {
    if (!open) return
    document.addEventListener('scroll', measure, { capture: true, passive: true } as EventListenerOptions)
    window.addEventListener('resize', measure, { passive: true } as EventListenerOptions)
    return () => {
      document.removeEventListener('scroll', measure, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', measure)
    }
  }, [open, measure])

  // Auto-focus first focusable item when portal opens
  useEffect(() => {
    if (!open || !autoFocus || !portalRef.current) return
    // Delay to ensure children are rendered
    const frame = requestAnimationFrame(() => {
      if (!portalRef.current) return
      const first = portalRef.current.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, autoFocus])

  // Keyboard handling: arrow nav, Tab trap + Escape when autoFocus is enabled
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!autoFocus || !portalRef.current) return

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose?.()
      anchorRef.current?.focus()
      return
    }

    const focusables = portalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Array.from(focusables).indexOf(document.activeElement as HTMLElement)
      const next = idx < focusables.length - 1 ? idx + 1 : 0
      focusables[next].focus()
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Array.from(focusables).indexOf(document.activeElement as HTMLElement)
      const prev = idx > 0 ? idx - 1 : focusables.length - 1
      focusables[prev].focus()
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ;(document.activeElement as HTMLElement)?.click()
      return
    }

    if (e.key === 'Tab') {
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          onClose?.()
          anchorRef.current?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          onClose?.()
          anchorRef.current?.focus()
        }
      }
    }
  }, [autoFocus, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <>
      {onClose && <div className={styles.backdrop} onClick={onClose} />}
      <div
        ref={portalRef}
        className={styles.portal}
        style={{ top: pos.top, left: pos.left, width: pos.width }}
        onKeyDown={autoFocus ? handleKeyDown : undefined}
      >
        {children}
      </div>
    </>,
    document.body
  )
}
