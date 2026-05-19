import { createPortal } from 'react-dom'
import { useLayoutEffect, useState, useEffect, useCallback, type ReactNode, type RefObject } from 'react'

interface DropdownPortalProps {
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  open: boolean
}

/**
 * Renders children in a portal (document.body) positioned below the anchor element.
 * Escapes any overflow clipping from parent containers (modals, scroll areas).
 * Re-measures on scroll and resize to stay aligned with the anchor.
 */
export function DropdownPortal({ anchorRef, children, open }: DropdownPortalProps) {
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
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      {children}
    </div>,
    document.body
  )
}
