import { useEffect, type RefObject } from 'react'

/**
 * Calls `handler` when a click occurs outside the referenced element.
 * Only active when `active` is true (default).
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  active = true
) {
  useEffect(() => {
    if (!active) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ref, handler, active])
}
