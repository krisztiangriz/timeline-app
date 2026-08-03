import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { safeGetItem, safeSetItem } from '../utils/safeStorage'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GuideStep {
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
  registerGuide: (guide: GuideDefinition) => void
  triggerGuide: (id: string) => void
  dismissGuide: (id: string) => void
  nextStep: (id: string) => void
  prevStep: (id: string) => void
  isGuideDismissed: (id: string) => boolean
  resetAllGuides: () => void
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
  return safeGetItem('onboarding-guides-disabled') === 'true'
}

/* ------------------------------------------------------------------ */
/*  Contexts                                                           */
/* ------------------------------------------------------------------ */

const OnboardingActionsContext = createContext<OnboardingActionsContextValue | null>(null)
const OnboardingStateContext = createContext<OnboardingStateContextValue | null>(null)

export function OnboardingGuidesProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(getDismissedGuides)
  const [registry, setRegistry] = useState<Map<string, GuideDefinition>>(new Map())
  const [activeGuide, setActiveGuide] = useState<ActiveGuide | null>(null)

  const guidesDisabledRef = useRef(getGuidesDisabled())
  const dismissedRef = useRef(dismissed)
  dismissedRef.current = dismissed
  const registryRef = useRef(registry)
  registryRef.current = registry

  const registerGuide = useCallback((guide: GuideDefinition) => {
    setRegistry((prev) => {
      if (prev.has(guide.id)) return prev
      const next = new Map(prev)
      next.set(guide.id, guide)
      registryRef.current = next
      return next
    })
  }, [])

  const isGuideDismissed = useCallback((id: string) => {
    return dismissedRef.current.includes(id)
  }, [])

  const triggerGuide = useCallback((id: string) => {
    if (guidesDisabledRef.current) return
    if (dismissedRef.current.includes(id)) return
    if (!registryRef.current.has(id)) return
    setActiveGuide({ id, currentStep: 0 })
  }, [])

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
      const definition = registryRef.current.get(id)
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
  }, [])

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
    return registryRef.current.get(id)
  }, [])

  const actionsValue = useMemo<OnboardingActionsContextValue>(() => ({
    registerGuide,
    triggerGuide,
    dismissGuide,
    nextStep,
    prevStep,
    isGuideDismissed,
    resetAllGuides,
    getGuideDefinition,
  }), [registerGuide, triggerGuide, dismissGuide, nextStep, prevStep, isGuideDismissed, resetAllGuides, getGuideDefinition])

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
