import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { type ReactNode, useRef, useEffect } from 'react'
import { OnboardingGuidesProvider, useOnboardingGuides } from '../hooks/useOnboardingGuides'
import { OnboardingGuide } from '../components/OnboardingGuide/OnboardingGuide'
import type { GuideDefinition } from '../hooks/useOnboardingGuides'

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

const singleStepGuide: GuideDefinition = {
  id: 'single',
  steps: [{ description: 'A simple guide' }],
}

const videoGuide: GuideDefinition = {
  id: 'video-test',
  steps: [{ description: 'Has video', video: '/onboarding/test.mp4' }],
}

const imageGuide: GuideDefinition = {
  id: 'image-test',
  steps: [{ description: 'Has image', image: '/onboarding/test.png' }],
}

const multiStepGuide: GuideDefinition = {
  id: 'multi',
  steps: [
    { description: 'First' },
    { description: 'Second' },
  ],
}

/** Helper component that registers, triggers a guide, and renders OnboardingGuide */
function TestHarness({ guide, anchored = false }: { guide: GuideDefinition; anchored?: boolean }) {
  const { registerGuide, triggerGuide } = useOnboardingGuides()
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    registerGuide(guide)
    triggerGuide(guide.id)
  }, [guide, registerGuide, triggerGuide])

  return (
    <div>
      <div ref={anchorRef} data-testid="anchor">Anchor Element</div>
      <OnboardingGuide
        guideId={guide.id}
        anchorRef={anchored ? anchorRef : undefined}
      />
    </div>
  )
}

function renderWithProvider(ui: ReactNode) {
  return render(
    <OnboardingGuidesProvider>{ui}</OnboardingGuidesProvider>
  )
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

describe('OnboardingGuide component', () => {
  describe('Rendering', () => {
    it('renders the guide card when active', () => {
      renderWithProvider(<TestHarness guide={singleStepGuide} />)

      expect(screen.getByText('A simple guide')).toBeInTheDocument()
    })

    it('does not render when guide is not active', () => {
      function InactiveTest() {
        const { registerGuide } = useOnboardingGuides()
        useEffect(() => { registerGuide(singleStepGuide) }, [registerGuide])
        return <OnboardingGuide guideId="single" />
      }

      renderWithProvider(<InactiveTest />)

      expect(screen.queryByText('A simple guide')).not.toBeInTheDocument()
    })

    it('renders confirm button for single-step guides', () => {
      renderWithProvider(<TestHarness guide={singleStepGuide} />)

      expect(screen.getByLabelText('Confirm')).toBeInTheDocument()
    })

    it('renders "Next" button for multi-step guides', () => {
      renderWithProvider(<TestHarness guide={multiStepGuide} />)

      expect(screen.getByLabelText('Next')).toBeInTheDocument()
      expect(screen.getByText('1 of 2')).toBeInTheDocument()
    })
  })

  describe('Video support', () => {
    it('renders a video element when step has video field', () => {
      renderWithProvider(<TestHarness guide={videoGuide} />)

      const video = document.querySelector('video')
      expect(video).toBeInTheDocument()
      expect(video).toHaveAttribute('autoplay')
      // 'muted' is a boolean IDL property — jsdom may not expose it as an attribute
      expect(video?.muted ?? video?.hasAttribute('muted')).toBeTruthy()

      const source = video?.querySelector('source')
      expect(source).toHaveAttribute('src', '/onboarding/test.mp4')
    })

    it('renders an image element when step has image field but no video', () => {
      renderWithProvider(<TestHarness guide={imageGuide} />)

      const img = document.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', '/onboarding/test.png')
      expect(document.querySelector('video')).not.toBeInTheDocument()
    })

    it('video takes priority over image when both are set', () => {
      const bothGuide: GuideDefinition = {
        id: 'both',
        steps: [{ description: 'Both set', video: '/v.mp4', image: '/i.png' }],
      }

      renderWithProvider(<TestHarness guide={bothGuide} />)

      expect(document.querySelector('video')).toBeInTheDocument()
      expect(document.querySelector('img')).not.toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('confirm button dismisses the guide', () => {
      renderWithProvider(<TestHarness guide={singleStepGuide} />)

      fireEvent.click(screen.getByLabelText('Confirm'))

      expect(screen.queryByText('A simple guide')).not.toBeInTheDocument()
    })

    it('multi-step: Next advances, Back goes back', () => {
      renderWithProvider(<TestHarness guide={multiStepGuide} />)

      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('1 of 2')).toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('Next'))

      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.getByText('2 of 2')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm')).toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('Back'))

      expect(screen.getByText('First')).toBeInTheDocument()
    })

    it('multi-step: Confirm on last step dismisses the guide', () => {
      renderWithProvider(<TestHarness guide={multiStepGuide} />)

      fireEvent.click(screen.getByLabelText('Next'))
      fireEvent.click(screen.getByLabelText('Confirm'))

      expect(screen.queryByText('Second')).not.toBeInTheDocument()
    })
  })

  describe('Centered mode (no anchor)', () => {
    it('renders without data-floating attribute when no anchorRef', () => {
      renderWithProvider(<TestHarness guide={singleStepGuide} anchored={false} />)

      const card = screen.getByText('A simple guide').closest('[class]')
      expect(card).not.toHaveAttribute('data-floating')
    })

    it('renders with data-floating attribute when anchorRef is provided', () => {
      renderWithProvider(<TestHarness guide={singleStepGuide} anchored={true} />)

      const card = screen.getByText('A simple guide').closest('[data-floating]')
      expect(card).toBeInTheDocument()
    })
  })
})
