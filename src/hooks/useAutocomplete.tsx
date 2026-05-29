import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Page } from '../types'

interface AutocompleteContextValue {
  allPages: Page[]
}

const AutocompleteContext = createContext<AutocompleteContextValue | null>(null)

export function useAutocomplete(): AutocompleteContextValue {
  const ctx = useContext(AutocompleteContext)
  if (!ctx) throw new Error('useAutocomplete must be used within AutocompleteProvider')
  return ctx
}

/**
 * Shallow-compare pages by the fields that matter for UI rendering.
 * Skips updatedAt/editCount which change on every timeline entry save
 * but don't affect mention display, autocomplete, or routing.
 */
function pagesEqual(a: Page[], b: Page[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const pa = a[i], pb = b[i]
    if (pa.id !== pb.id || pa.name !== pb.name || pa.type !== pb.type ||
        pa.parentId !== pb.parentId || pa.role !== pb.role ||
        pa.mentionTrigger !== pb.mentionTrigger ||
        pa.mentionCollapsed !== pb.mentionCollapsed ||
        pa.archived !== pb.archived || pa.isDraft !== pb.isDraft) return false
  }
  return true
}

export function AutocompleteProvider({ children }: { children: ReactNode }) {
  const rawPages = useLiveQuery(() => db.pages.filter((p) => !p.isDraft).toArray()) ?? []
  const stableRef = useRef<Page[]>(rawPages)

  // Only update the reference when meaningful fields change
  if (!pagesEqual(stableRef.current, rawPages)) {
    stableRef.current = rawPages
  }
  const allPages = stableRef.current

  const value = useMemo<AutocompleteContextValue>(() => ({ allPages }), [allPages])

  return (
    <AutocompleteContext.Provider value={value}>
      {children}
    </AutocompleteContext.Provider>
  )
}
