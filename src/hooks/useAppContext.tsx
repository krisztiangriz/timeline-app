import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

interface AppContextValue {
  feedbackOpen: boolean
  setFeedbackOpen: (v: boolean) => void
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void
  addPageOpen: boolean
  setAddPageOpen: (v: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  helpOpen: boolean
  setHelpOpen: (v: boolean) => void
  showArchived: boolean
  setShowArchived: (v: boolean) => void
}

const AppContext = createContext<AppContextValue>({
  feedbackOpen: false,
  setFeedbackOpen: () => {},
  searchOpen: false,
  setSearchOpen: () => {},
  addPageOpen: false,
  setAddPageOpen: () => {},
  settingsOpen: false,
  setSettingsOpen: () => {},
  helpOpen: false,
  setHelpOpen: () => {},
  showArchived: false,
  setShowArchived: () => {},
})

export function useAppContext() {
  return useContext(AppContext)
}

function isInsideRichEditor(): boolean {
  const active = document.activeElement
  if (!active) return false
  return active.closest('[data-rich-editor]') !== null
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [addPageOpen, setAddPageOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [showArchived, setShowArchivedState] = useState(() => localStorage.getItem('show-archived') === 'true')

  function setShowArchived(v: boolean) {
    setShowArchivedState(v)
    localStorage.setItem('show-archived', String(v))
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+Shift+F → open feedback form
    if (e.ctrlKey && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      setFeedbackOpen(true)
    }

    // Ctrl+Shift+K → open search (when not inside a rich editor)
    if (e.ctrlKey && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      if (!isInsideRichEditor()) {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }

    // Escape → blur active element (deselect)
    if (e.key === 'Escape') {
      const active = document.activeElement as HTMLElement | null
      if (active && active !== document.body) {
        active.blur()
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <AppContext.Provider
      value={{
        feedbackOpen, setFeedbackOpen,
        searchOpen, setSearchOpen,
        addPageOpen, setAddPageOpen,
        settingsOpen, setSettingsOpen,
        helpOpen, setHelpOpen,
        showArchived, setShowArchived,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
