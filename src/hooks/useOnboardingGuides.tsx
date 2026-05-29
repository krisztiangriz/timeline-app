import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/safeStorage'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GuideStep {
  description: string
  image?: string
  video?: string
}

export interface GuideDefinition {
  /** Unique identifier for this guide */
  id: string
  /** Steps in this guide sequence (single-step guides have one entry) */
  steps: GuideStep[]
}

interface ActiveGuide {
  id: string
  currentStep: number
}

interface OnboardingActionsContextValue {
  /** Whether all guides are globally disabled */
  guidesDisabled: boolean
  /** Disable all contextual guides */
  disableAllGuides: () => void
  /** Enable all contextual guides */
  enableAllGuides: () => void
  /** Toggle guides on/off */
  toggleGuides: () => void
  /** Register a guide definition (idempotent) */
  registerGuide: (guide: GuideDefinition) => void
  /** Trigger a guide to show (only if not dismissed and guides enabled) */
  triggerGuide: (id: string) => void
  /** Dismiss the currently active guide (marks it as seen) */
  dismissGuide: (id: string) => void
  /** Advance to the next step of a multi-step guide */
  nextStep: (id: string) => void
  /** Go back to the previous step of a multi-step guide */
  prevStep: (id: string) => void
  /** Check if a guide has been dismissed */
  isGuideDismissed: (id: string) => boolean
  /** Reset all dismissed guides */
  resetAllGuides: () => void
  /** Get the definition for a guide by id */
  getGuideDefinition: (id: string) => GuideDefinition | undefined
}

interface OnboardingStateContextValue {
  /** The currently active guide (if any) */
  activeGuide: ActiveGuide | null
}

// Combined type for backward-compatible useOnboardingGuides hook
interface OnboardingGuidesContextValue extends OnboardingActionsContextValue, OnboardingStateContextValue {}

/* ------------------------------------------------------------------ */
/*  localStorage keys                                                  */
/* ------------------------------------------------------------------ */

const STORAGE_KEY_DISMISSED = 'onboarding-guides-dismissed'
const STORAGE_KEY_DISABLED = 'onboarding-guides-disabled'

function getDismissedGuides(): string[] {
  try {
    const raw = safeGetItem(STORAGE_KEY_DISMISSED)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setDismissedGuides(ids: string[]) {
  safeSetItem(STORAGE_KEY_DISMISSED, JSON.stringify(ids))
}

function getGuidesDisabled(): boolean {
  return safeGetItem(STORAGE_KEY_DISABLED) === 'true'
}

function setGuidesDisabledStorage(disabled: boolean) {
  if (disabled) {
    safeSetItem(STORAGE_KEY_DISABLED, 'true')
  } else {
    safeRemoveItem(STORAGE_KEY_DISABLED)
  }
}

/* ------------------------------------------------------------------ */
/*  Contexts                                                           */
/* ------------------------------------------------------------------ */

const OnboardingActionsContext = createContext<OnboardingActionsContextValue | null>(null)
const OnboardingStateContext = createContext<OnboardingStateContextValue | null>(null)

export function OnboardingGuidesProvider({ children }: { children: ReactNode }) {
  const [guidesDisabled, setGuidesDisabled] = useState(getGuidesDisabled)
  const [dismissed, setDismissed] = useState(getDismissedGuides)
  const [registry, setRegistry] = useState<Map<string, GuideDefinition>>(new Map())
  const [activeGuide, setActiveGuide] = useState<ActiveGuide | null>(null)

  // Refs for stable callbacks (ref pattern — avoids recreating triggerGuide on guidesDisabled/dismissed changes)
  const guidesDisabledRef = useRef(guidesDisabled)
  guidesDisabledRef.current = guidesDisabled
  const dismissedRef = useRef(dismissed)
  dismissedRef.current = dismissed

  const disableAllGuides = useCallback(() => {
    setGuidesDisabled(true)
    setGuidesDisabledStorage(true)
    setActiveGuide(null)
  }, [])

  const enableAllGuides = useCallback(() => {
    setGuidesDisabled(false)
    setGuidesDisabledStorage(false)
  }, [])

  const toggleGuides = useCallback(() => {
    setGuidesDisabled((prev) => {
      const next = !prev
      setGuidesDisabledStorage(next)
      if (next) setActiveGuide(null)
      return next
    })
  }, [])

  const registerGuide = useCallback((guide: GuideDefinition) => {
    setRegistry((prev) => {
      if (prev.has(guide.id)) return prev
      const next = new Map(prev)
      next.set(guide.id, guide)
      return next
    })
  }, [])

  const isGuideDismissed = useCallback((id: string) => {
    return dismissedRef.current.includes(id)
  }, [])

  const triggerGuide = useCallback((id: string) => {
    if (guidesDisabledRef.current) return
    if (dismissedRef.current.includes(id)) return
    if (!registry.has(id)) return
    setActiveGuide({ id, currentStep: 0 })
  }, [registry])

  const dismissGuide = useCallback((id: string) => {
    setDismissed((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      setDismissedGuides(next)
      return next
    })
    setActiveGuide((current) => (current?.id === id ? null : current))
  }, [])

  const nextStep = useCallback((id: string) => {
    setActiveGuide((current) => {
      if (!current || current.id !== id) return current
      const definition = registry.get(id)
      if (!definition) return current
      const maxStep = definition.steps.length - 1
      if (current.currentStep >= maxStep) {
        // Last step — dismiss the guide
        setDismissed((prev) => {
          if (prev.includes(id)) return prev
          const next = [...prev, id]
          setDismissedGuides(next)
          return next
        })
        return null
      }
      return { ...current, currentStep: current.currentStep + 1 }
    })
  }, [registry])

  const prevStep = useCallback((id: string) => {
    setActiveGuide((current) => {
      if (!current || current.id !== id) return current
      if (current.currentStep <= 0) return current
      return { ...current, currentStep: current.currentStep - 1 }
    })
  }, [])

  const resetAllGuides = useCallback(() => {
    setDismissed([])
    setDismissedGuides([])
  }, [])

  const getGuideDefinition = useCallback((id: string) => {
    return registry.get(id)
  }, [registry])

  // Actions context — stable (callbacks never change identity)
  const actionsValue = useMemo<OnboardingActionsContextValue>(() => ({
    guidesDisabled,
    disableAllGuides,
    enableAllGuides,
    toggleGuides,
    registerGuide,
    triggerGuide,
    dismissGuide,
    nextStep,
    prevStep,
    isGuideDismissed,
    resetAllGuides,
    getGuideDefinition,
  }), [
    guidesDisabled,
    disableAllGuides,
    enableAllGuides,
    toggleGuides,
    registerGuide,
    triggerGuide,
    dismissGuide,
    nextStep,
    prevStep,
    isGuideDismissed,
    resetAllGuides,
    getGuideDefinition,
  ])

  // State context — only changes when activeGuide changes
  const stateValue = useMemo<OnboardingStateContextValue>(() => ({
    activeGuide,
  }), [activeGuide])

  return (
    <OnboardingActionsContext.Provider value={actionsValue}>
      <OnboardingStateContext.Provider value={stateValue}>
        {children}
      </OnboardingStateContext.Provider>
    </OnboardingActionsContext.Provider>
  )
}

/**
 * Full context hook — for components that need both actions AND state (e.g., OnboardingGuide, SettingsModal).
 * Most consumers should prefer useOnboardingActions() to avoid re-renders on activeGuide changes.
 */
export function useOnboardingGuides(): OnboardingGuidesContextValue {
  const actions = useContext(OnboardingActionsContext)
  const state = useContext(OnboardingStateContext)
  if (!actions || !state) {
    throw new Error('useOnboardingGuides must be used within OnboardingGuidesProvider')
  }
  return { ...actions, ...state }
}

/**
 * Actions-only hook — stable references, does NOT re-render when activeGuide changes.
 * Use this in components that only call triggerGuide/registerGuide/etc.
 */
export function useOnboardingActions() {
  const ctx = useContext(OnboardingActionsContext)
  if (!ctx) {
    throw new Error('useOnboardingActions must be used within OnboardingGuidesProvider')
  }
  return ctx
}
