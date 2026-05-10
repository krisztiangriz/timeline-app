import { useCallback, useRef, useState } from 'react'

/**
 * Detects when the page has scrolled past the sticky header's original position.
 * Returns a callback ref for a sentinel div (place before the sticky header) and a boolean.
 * Uses a callback ref to handle cases where the sentinel element is not in the DOM on first render
 * (e.g., when the component initially returns null while waiting for async data).
 */
export function useStickyScroll() {
  const [isScrolled, setIsScrolled] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(node)
    observerRef.current = observer
  }, [])

  return { sentinelRef, isScrolled }
}
