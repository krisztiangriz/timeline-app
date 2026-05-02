import { useEffect, useRef, useState } from 'react'

/**
 * Detects when the page has scrolled past the sticky header's original position.
 * Returns a ref for a sentinel div (place before the sticky header) and a boolean.
 */
export function useStickyScroll() {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting)
      },
      { threshold: 0 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return { sentinelRef, isScrolled }
}
