import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GuideStep {
  title: string
  description: string
  image?: string
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

interface OnboardingGuidesContextValue {
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
  /** The currently active guide (if any) */
  activeGuide: ActiveGuide | null
  /** Get the definition for a guide by id */
  getGuideDefinition: (id: string) => GuideDefinition | undefined
}

/* ------------------------------------------------------------------ */
/*  localStorage keys                                                  */
/* ------------------------------------------------------------------ */

const STORAGE_KEY_DISMISSED = 'onboarding-guides-dismissed'
const STORAGE_KEY_DISABLED = 'onboarding-guides-disabled'

function getDismissedGuides(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setDismissedGuides(ids: string[]) {
  localStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(ids))
}

function getGuidesDisabled(): boolean {
  return localStorage.getItem(STORAGE_KEY_DISABLED) === 'true'
}

function setGuidesDisabledStorage(disabled: boolean) {
  if (disabled) {
    localStorage.setItem(STORAGE_KEY_DISABLED, 'true')
  } else {
    localStorage.removeItem(STORAGE_KEY_DISABLED)
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const OnboardingGuidesContext = createContext<OnboardingGuidesContextValue | null>(null)

export function OnboardingGuidesProvider({ children }: { children: ReactNode }) {
  const [guidesDisabled, setGuidesDisabled] = useState(getGuidesDisabled)
  const [dismissed, setDismissed] = useState(getDismissedGuides)
  const [registry, setRegistry] = useState<Map<string, GuideDefinition>>(new Map())
  const [activeGuide, setActiveGuide] = useState<ActiveGuide | null>(null)

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
    return dismissed.includes(id)
  }, [dismissed])

  const triggerGuide = useCallback((id: string) => {
    if (guidesDisabled) return
    if (dismissed.includes(id)) return
    if (!registry.has(id)) return
    setActiveGuide({ id, currentStep: 0 })
  }, [guidesDisabled, dismissed, registry])

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

  return (
    <OnboardingGuidesContext.Provider
      value={{
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
        activeGuide,
        getGuideDefinition,
      }}
    >
      {children}
    </OnboardingGuidesContext.Provider>
  )
}

export function useOnboardingGuides() {
  const ctx = useContext(OnboardingGuidesContext)
  if (!ctx) {
    throw new Error('useOnboardingGuides must be used within OnboardingGuidesProvider')
  }
  return ctx
}
