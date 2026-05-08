import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type ReactNode } from 'react'
import { OnboardingGuidesProvider, useOnboardingGuides } from '../hooks/useOnboardingGuides'
import type { GuideDefinition } from '../hooks/useOnboardingGuides'

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

function wrapper({ children }: { children: ReactNode }) {
  return <OnboardingGuidesProvider>{children}</OnboardingGuidesProvider>
}

function renderGuideHook() {
  return renderHook(() => useOnboardingGuides(), { wrapper })
}

const singleStepGuide: GuideDefinition = {
  id: 'test-guide',
  steps: [{ title: 'Test', description: 'A test guide' }],
}

const multiStepGuide: GuideDefinition = {
  id: 'multi-step',
  steps: [
    { title: 'Step 1', description: 'First step', video: '/onboarding/step1.mp4' },
    { title: 'Step 2', description: 'Second step', image: '/onboarding/step2.png' },
    { title: 'Step 3', description: 'Third step' },
  ],
}

const videoGuide: GuideDefinition = {
  id: 'video-guide',
  steps: [{ title: 'Video', description: 'Has a video', video: '/onboarding/test.mp4' }],
}

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  localStorage.clear()
})

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('OnboardingGuidesProvider', () => {
  describe('Registration', () => {
    it('registers a guide and makes it available', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })

      expect(result.current.getGuideDefinition('test-guide')).toEqual(singleStepGuide)
    })

    it('registration is idempotent — registering twice does not duplicate', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.registerGuide(singleStepGuide) })

      expect(result.current.getGuideDefinition('test-guide')).toEqual(singleStepGuide)
    })

    it('returns undefined for unregistered guide', () => {
      const { result } = renderGuideHook()

      expect(result.current.getGuideDefinition('nonexistent')).toBeUndefined()
    })

    it('supports guides with video field in steps', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(videoGuide) })

      const def = result.current.getGuideDefinition('video-guide')
      expect(def?.steps[0].video).toBe('/onboarding/test.mp4')
    })
  })

  describe('Triggering', () => {
    it('triggers a registered guide — sets activeGuide', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.triggerGuide('test-guide') })

      expect(result.current.activeGuide).toEqual({ id: 'test-guide', currentStep: 0 })
    })

    it('does not trigger an unregistered guide', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.triggerGuide('nonexistent') })

      expect(result.current.activeGuide).toBeNull()
    })

    it('does not trigger a dismissed guide', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.dismissGuide('test-guide') })
      act(() => { result.current.triggerGuide('test-guide') })

      expect(result.current.activeGuide).toBeNull()
    })

    it('does not trigger when guides are globally disabled', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.disableAllGuides() })
      act(() => { result.current.triggerGuide('test-guide') })

      expect(result.current.activeGuide).toBeNull()
    })

    it('re-triggering a non-dismissed guide shows it again', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.triggerGuide('test-guide') })
      // Simulate user navigating away (activeGuide cleared by something else)
      // Then re-trigger
      act(() => { result.current.triggerGuide('test-guide') })

      expect(result.current.activeGuide).toEqual({ id: 'test-guide', currentStep: 0 })
    })
  })

  describe('Dismissal', () => {
    it('dismissGuide clears activeGuide and marks as dismissed', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.triggerGuide('test-guide') })
      act(() => { result.current.dismissGuide('test-guide') })

      expect(result.current.activeGuide).toBeNull()
      expect(result.current.isGuideDismissed('test-guide')).toBe(true)
    })

    it('dismissed state persists to localStorage', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.dismissGuide('test-guide') })

      const stored = JSON.parse(localStorage.getItem('onboarding-guides-dismissed') ?? '[]')
      expect(stored).toContain('test-guide')
    })

    it('dismissing a non-active guide does not affect activeGuide', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.registerGuide(multiStepGuide) })
      act(() => { result.current.triggerGuide('test-guide') })
      act(() => { result.current.dismissGuide('multi-step') })

      expect(result.current.activeGuide).toEqual({ id: 'test-guide', currentStep: 0 })
    })
  })

  describe('Multi-step navigation', () => {
    it('nextStep advances to the next step', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(multiStepGuide) })
      act(() => { result.current.triggerGuide('multi-step') })

      expect(result.current.activeGuide?.currentStep).toBe(0)

      act(() => { result.current.nextStep('multi-step') })
      expect(result.current.activeGuide?.currentStep).toBe(1)

      act(() => { result.current.nextStep('multi-step') })
      expect(result.current.activeGuide?.currentStep).toBe(2)
    })

    it('nextStep on the last step auto-dismisses the guide', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(multiStepGuide) })
      act(() => { result.current.triggerGuide('multi-step') })

      // Advance to last step
      act(() => { result.current.nextStep('multi-step') })
      act(() => { result.current.nextStep('multi-step') })
      // Now on step 2 (last). Next should dismiss.
      act(() => { result.current.nextStep('multi-step') })

      expect(result.current.activeGuide).toBeNull()
      expect(result.current.isGuideDismissed('multi-step')).toBe(true)
    })

    it('prevStep goes back to the previous step', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(multiStepGuide) })
      act(() => { result.current.triggerGuide('multi-step') })
      act(() => { result.current.nextStep('multi-step') })

      expect(result.current.activeGuide?.currentStep).toBe(1)

      act(() => { result.current.prevStep('multi-step') })
      expect(result.current.activeGuide?.currentStep).toBe(0)
    })

    it('prevStep on the first step does nothing', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(multiStepGuide) })
      act(() => { result.current.triggerGuide('multi-step') })

      act(() => { result.current.prevStep('multi-step') })
      expect(result.current.activeGuide?.currentStep).toBe(0)
    })

    it('nextStep/prevStep for wrong guide id does nothing', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(multiStepGuide) })
      act(() => { result.current.triggerGuide('multi-step') })

      act(() => { result.current.nextStep('wrong-id') })
      expect(result.current.activeGuide?.currentStep).toBe(0)

      act(() => { result.current.prevStep('wrong-id') })
      expect(result.current.activeGuide?.currentStep).toBe(0)
    })
  })

  describe('Global enable/disable', () => {
    it('disableAllGuides hides active guide and prevents triggers', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.triggerGuide('test-guide') })
      expect(result.current.activeGuide).not.toBeNull()

      act(() => { result.current.disableAllGuides() })
      expect(result.current.activeGuide).toBeNull()
      expect(result.current.guidesDisabled).toBe(true)

      // Cannot trigger while disabled
      act(() => { result.current.triggerGuide('test-guide') })
      expect(result.current.activeGuide).toBeNull()
    })

    it('enableAllGuides re-enables triggering', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.disableAllGuides() })
      act(() => { result.current.enableAllGuides() })
      act(() => { result.current.triggerGuide('test-guide') })

      expect(result.current.activeGuide).toEqual({ id: 'test-guide', currentStep: 0 })
    })

    it('toggleGuides flips the disabled state', () => {
      const { result } = renderGuideHook()

      expect(result.current.guidesDisabled).toBe(false)

      act(() => { result.current.toggleGuides() })
      expect(result.current.guidesDisabled).toBe(true)

      act(() => { result.current.toggleGuides() })
      expect(result.current.guidesDisabled).toBe(false)
    })

    it('disabled state persists to localStorage', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.disableAllGuides() })
      expect(localStorage.getItem('onboarding-guides-disabled')).toBe('true')

      act(() => { result.current.enableAllGuides() })
      expect(localStorage.getItem('onboarding-guides-disabled')).toBeNull()
    })
  })

  describe('Reset', () => {
    it('resetAllGuides clears all dismissed guides', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.registerGuide(multiStepGuide) })
      act(() => { result.current.dismissGuide('test-guide') })
      act(() => { result.current.dismissGuide('multi-step') })

      expect(result.current.isGuideDismissed('test-guide')).toBe(true)
      expect(result.current.isGuideDismissed('multi-step')).toBe(true)

      act(() => { result.current.resetAllGuides() })

      expect(result.current.isGuideDismissed('test-guide')).toBe(false)
      expect(result.current.isGuideDismissed('multi-step')).toBe(false)
    })

    it('reset clears localStorage', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.dismissGuide('test-guide') })
      act(() => { result.current.resetAllGuides() })

      const stored = JSON.parse(localStorage.getItem('onboarding-guides-dismissed') ?? '[]')
      expect(stored).toEqual([])
    })

    it('after reset, previously dismissed guides can be triggered again', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      act(() => { result.current.dismissGuide('test-guide') })
      act(() => { result.current.resetAllGuides() })
      act(() => { result.current.triggerGuide('test-guide') })

      expect(result.current.activeGuide).toEqual({ id: 'test-guide', currentStep: 0 })
    })
  })

  describe('Persistence across instances', () => {
    it('new provider instance reads dismissed guides from localStorage', () => {
      // Simulate a previous session that dismissed a guide
      localStorage.setItem('onboarding-guides-dismissed', JSON.stringify(['previously-dismissed']))

      const { result } = renderGuideHook()

      expect(result.current.isGuideDismissed('previously-dismissed')).toBe(true)
    })

    it('new provider instance reads disabled state from localStorage', () => {
      localStorage.setItem('onboarding-guides-disabled', 'true')

      const { result } = renderGuideHook()

      expect(result.current.guidesDisabled).toBe(true)
    })

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('onboarding-guides-dismissed', 'not-valid-json{{{')

      const { result } = renderGuideHook()

      // Should not crash, should return empty
      expect(result.current.isGuideDismissed('anything')).toBe(false)
    })
  })

  describe('Context memoization', () => {
    it('context value is stable when no state changes', () => {
      const { result, rerender } = renderGuideHook()

      const valueBefore = result.current
      rerender()
      const valueAfter = result.current

      // The individual callback references should be stable (useCallback)
      expect(valueBefore.registerGuide).toBe(valueAfter.registerGuide)
      expect(valueBefore.dismissGuide).toBe(valueAfter.dismissGuide)
      expect(valueBefore.resetAllGuides).toBe(valueAfter.resetAllGuides)
      expect(valueBefore.prevStep).toBe(valueAfter.prevStep)
    })

    it('registerGuide does not trigger unnecessary re-renders when guide already registered', () => {
      const { result } = renderGuideHook()

      act(() => { result.current.registerGuide(singleStepGuide) })
      const activeAfterFirst = result.current.activeGuide

      // Registering the same guide again should not change state
      act(() => { result.current.registerGuide(singleStepGuide) })
      expect(result.current.activeGuide).toBe(activeAfterFirst)
    })
  })
})
