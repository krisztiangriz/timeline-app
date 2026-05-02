import { createContext, useContext, type ReactNode } from 'react'
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

  return (
    <AutocompleteContext.Provider value={{ allPages }}>
      {children}
    </AutocompleteContext.Provider>
  )
}
