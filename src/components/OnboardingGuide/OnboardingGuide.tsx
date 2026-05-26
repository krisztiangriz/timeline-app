import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import { useOnboardingGuides } from '../../hooks/useOnboardingGuides'
import { CheckIcon, ArrowLeftIcon, ArrowRightIcon } from '../Icons/Icons'
import styles from './OnboardingGuide.module.css'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GuidePosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'left-center'
  | 'right-center'
  | 'right-top'

interface OnboardingGuideProps {
  /** The guide ID to render (must be registered in the context) */
  guideId: string
  /** Ref to the anchor element this card should float near */
  anchorRef?: React.RefObject<HTMLElement | null>
  /** Fixed position relative to the anchor. Defaults to 'bottom-left'. */
  position?: GuidePosition
  /** Offset in px from the anchor element */
  offset?: number
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OnboardingGuide({
  guideId,
  anchorRef,
  position = 'bottom-left',
  offset = 8,
}: OnboardingGuideProps) {
  const {
    activeGuide,
    getGuideDefinition,
    dismissGuide,
    nextStep,
    prevStep,
  } = useOnboardingGuides()

  const cardRef = useRef<HTMLDivElement>(null)
  const [posStyle, setPosStyle] = useState<CSSProperties>({})

  // Only render if this guide is the active one
  const isActive = activeGuide?.id === guideId
  const definition = getGuideDefinition(guideId)

  const computePosition = useCallback(() => {
    if (!anchorRef?.current || !cardRef.current) return

    const anchorRect = anchorRef.current.getBoundingClientRect()
    const cardRect = cardRef.current.getBoundingClientRect()
    const gap = offset

    let top = 0
    let left = 0

    switch (position) {
      case 'bottom-left':
        top = anchorRect.bottom + gap
        left = anchorRect.left
        break
      case 'bottom-center':
        top = anchorRect.bottom + gap
        left = anchorRect.left + anchorRect.width / 2 - cardRect.width / 2
        break
      case 'bottom-right':
        top = anchorRect.bottom + gap
        left = anchorRect.right - cardRect.width
        break
      case 'top-left':
        top = anchorRect.top - cardRect.height - gap
        left = anchorRect.left
        break
      case 'top-center':
        top = anchorRect.top - cardRect.height - gap
        left = anchorRect.left + anchorRect.width / 2 - cardRect.width / 2
        break
      case 'top-right':
        top = anchorRect.top - cardRect.height - gap
        left = anchorRect.right - cardRect.width
        break
      case 'left-center':
        top = anchorRect.top + anchorRect.height / 2 - cardRect.height / 2
        left = anchorRect.left - cardRect.width - gap
        break
      case 'right-center':
        top = anchorRect.top + anchorRect.height / 2 - cardRect.height / 2
        left = anchorRect.right + gap
        break
      case 'right-top':
        top = anchorRect.top
        left = anchorRect.right - cardRect.width
        break
    }

    // Clamp to viewport
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    top = Math.max(8, Math.min(top, viewportH - cardRect.height - 8))
    left = Math.max(8, Math.min(left, viewportW - cardRect.width - 8))

    setPosStyle({ top: `${top}px`, left: `${left}px` })
  }, [anchorRef, position, offset])

  useEffect(() => {
    if (!isActive) return
    // Compute position on mount and on resize/scroll (throttled via rAF)
    const frame = requestAnimationFrame(computePosition)
    let rafId: number | null = null
    const throttledReposition = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        computePosition()
        rafId = null
      })
    }
    window.addEventListener('resize', throttledReposition)
    window.addEventListener('scroll', throttledReposition, true)
    return () => {
      cancelAnimationFrame(frame)
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', throttledReposition)
      window.removeEventListener('scroll', throttledReposition, true)
    }
  }, [isActive, computePosition])

  // Re-compute when card mounts (so we have cardRef dimensions)
  useEffect(() => {
    if (isActive && cardRef.current) {
      computePosition()
    }
  }, [isActive, computePosition])

  if (!isActive || !definition) return null

  const step = definition.steps[activeGuide!.currentStep]
  const totalSteps = definition.steps.length
  const currentStepIdx = activeGuide!.currentStep
  const isMultiStep = totalSteps > 1
  const isLastStep = currentStepIdx === totalSteps - 1
  const isFirstStep = currentStepIdx === 0

  return (
    <div
      ref={cardRef}
      className={styles.card}
      style={anchorRef ? posStyle : undefined}
      data-floating={anchorRef ? '' : undefined}
    >
      {/* Optional video (takes priority over image) */}
      {step.video && (
        <div className={styles.imageWrap}>
          <video key={step.video} autoPlay loop muted playsInline className={styles.video}>
            <source src={step.video} type="video/mp4" />
          </video>
        </div>
      )}

      {/* Optional image (only if no video) */}
      {!step.video && step.image && (
        <div className={styles.imageWrap}>
          <img src={step.image} alt="" className={styles.image} />
        </div>
      )}

      {/* Description */}
      <p className={styles.description}>{step.description}</p>

      {/* Footer with step indicator and navigation */}
      {isMultiStep && (
        <div className={styles.footer}>
          <span className={styles.stepIndicator}>
            {currentStepIdx + 1} of {totalSteps}
          </span>
          <div className={styles.footerButtons}>
            {!isFirstStep && (
              <button
                className={styles.confirmButton}
                onClick={() => prevStep(guideId)}
                aria-label="Back"
              >
                <ArrowLeftIcon />
              </button>
            )}
            {!isLastStep && (
              <button
                className={styles.confirmButton}
                onClick={() => nextStep(guideId)}
                aria-label="Next"
              >
                <ArrowRightIcon />
              </button>
            )}
            {isLastStep && (
              <button
                className={styles.confirmButton}
                onClick={() => nextStep(guideId)}
                aria-label="Confirm"
              >
                <CheckIcon />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Single-step: confirm button */}
      {!isMultiStep && (
        <div className={styles.footer}>
          <span />
          <button
            className={styles.confirmButton}
            onClick={() => dismissGuide(guideId)}
            aria-label="Confirm"
          >
            <CheckIcon />
          </button>
        </div>
      )}
    </div>
  )
}
