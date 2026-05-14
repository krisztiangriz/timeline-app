import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAutocomplete } from './useAutocomplete'
import { getPagePath } from './usePages'

/**
 * Returns a stable callback that navigates to a page by its ID.
 * Uses a ref pattern to avoid re-creating the callback on every allPages change.
 */
export function useNavigateToPage() {
  const { allPages } = useAutocomplete()
  const navigate = useNavigate()
  const allPagesRef = useRef(allPages)
  allPagesRef.current = allPages

  return useCallback((pageId: number) => {
    const page = allPagesRef.current.find((p) => p.id === pageId)
    if (page) {
      navigate(getPagePath(page, allPagesRef.current))
    } else {
      navigate(`/page/${pageId}`)
    }
  }, [navigate])
}
