import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'

// ---- Types for page creation from trigger dropdown ----

export interface AddPageInitial {
  name?: string
  parentHubId?: number
  /** The trigger prefix that was used (e.g., '#') — needed for mention insertion */
  triggerPrefix?: string
  /** The full trigger text to find and replace in the editor (e.g., '#NewProject') */
  triggerText?: string
}

export interface PendingMentionInsert {
  pageId: number
  name: string
  prefix: string
  /** The text to search for and replace in the editor */
  triggerText: string
}

// ---- Modal context (open/close states for all modals) ----

interface ModalContextValue {
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
  onboardingOpen: boolean
  setOnboardingOpen: (v: boolean) => void
  addPageInitial: AddPageInitial | undefined
  setAddPageInitial: (v: AddPageInitial | undefined) => void
  pendingMentionInsert: PendingMentionInsert | null
  setPendingMentionInsert: (v: PendingMentionInsert | null) => void
}

const ModalContext = createContext<ModalContextValue>({
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
  onboardingOpen: false,
  setOnboardingOpen: () => {},
  addPageInitial: undefined,
  setAddPageInitial: () => {},
  pendingMentionInsert: null,
  setPendingMentionInsert: () => {},
})

// ---- Preferences context (user settings persisted to localStorage) ----

interface PreferencesContextValue {
  showArchived: boolean
  setShowArchived: (v: boolean) => void
}

const PreferencesContext = createContext<PreferencesContextValue>({
  showArchived: false,
  setShowArchived: () => {},
})

// ---- Hooks ----

/** Use modal open/close states only (won't re-render on preference changes) */
export function useModalContext() {
  return useContext(ModalContext)
}

/** Use user preferences only (won't re-render on modal open/close) */
export function usePreferences() {
  return useContext(PreferencesContext)
}

// ---- Provider ----

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
  const [onboardingOpen, setOnboardingOpen] = useState(() => localStorage.getItem('onboarding-completed') !== 'true')
  const [addPageInitial, setAddPageInitial] = useState<AddPageInitial | undefined>(undefined)
  const [pendingMentionInsert, setPendingMentionInsert] = useState<PendingMentionInsert | null>(null)
  const [showArchived, setShowArchivedState] = useState(() => localStorage.getItem('show-archived') === 'true')

  const setShowArchived = useCallback((v: boolean) => {
    setShowArchivedState(v)
    localStorage.setItem('show-archived', String(v))
  }, [])

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

  const modalValue = useMemo<ModalContextValue>(() => ({
    feedbackOpen, setFeedbackOpen,
    searchOpen, setSearchOpen,
    addPageOpen, setAddPageOpen,
    settingsOpen, setSettingsOpen,
    helpOpen, setHelpOpen,
    onboardingOpen, setOnboardingOpen,
    addPageInitial, setAddPageInitial,
    pendingMentionInsert, setPendingMentionInsert,
  }), [feedbackOpen, searchOpen, addPageOpen, settingsOpen, helpOpen, onboardingOpen, addPageInitial, pendingMentionInsert])

  const prefsValue = useMemo<PreferencesContextValue>(() => ({
    showArchived, setShowArchived,
  }), [showArchived, setShowArchived])

  return (
    <ModalContext.Provider value={modalValue}>
      <PreferencesContext.Provider value={prefsValue}>
        {children}
      </PreferencesContext.Provider>
    </ModalContext.Provider>
  )
}
