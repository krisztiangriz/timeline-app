import { createContext, useContext, useMemo, type ReactNode } from 'react'
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

export function AutocompleteProvider({ children }: { children: ReactNode }) {
  const allPages = useLiveQuery(() => db.pages.toArray()) ?? []

  const value = useMemo<AutocompleteContextValue>(() => ({ allPages }), [allPages])

  return (
    <AutocompleteContext.Provider value={value}>
      {children}
    </AutocompleteContext.Provider>
  )
}
