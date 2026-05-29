import { createPortal } from 'react-dom'
import { useLayoutEffect, useState, useEffect, useCallback, type ReactNode, type RefObject } from 'react'
import styles from './DropdownPortal.module.css'

interface DropdownPortalProps {
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  open: boolean
  onClose?: () => void
}

/**
 * Renders children in a portal (document.body) positioned below the anchor element.
 * Escapes any overflow clipping from parent containers (modals, scroll areas).
 * Re-measures on scroll and resize to stay aligned with the anchor.
 * When onClose is provided, renders an invisible backdrop that closes the dropdown on click.
 */
export function DropdownPortal({ anchorRef, children, open, onClose }: DropdownPortalProps) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

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

  if (!open) return null

  return createPortal(
    <>
      {onClose && <div className={styles.backdrop} onClick={onClose} />}
      <div className={styles.portal} style={{ top: pos.top, left: pos.left, width: pos.width }}>
        {children}
      </div>
    </>,
    document.body
  )
}
