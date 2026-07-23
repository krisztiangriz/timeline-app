import { useState, useEffect, useRef } from 'react'
import type { TimelineEntry } from '../types'

export function useEditorSync(entry: TimelineEntry | undefined) {
  const [html, setHtml] = useState('')
  const entryIdRef = useRef<number | undefined>(undefined)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (entry) {
      entryIdRef.current = entry.id
      if (!focusedRef.current) setHtml(entry.text)
    } else {
      entryIdRef.current = undefined
      if (!focusedRef.current) setHtml('')
    }
  }, [entry])

  return { html, setHtml, entryIdRef, focusedRef }
}
