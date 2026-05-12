import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import { useOnboardingGuides } from '../../hooks/useOnboardingGuides'
import { CheckIcon } from '../Icons/Icons'
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
    // Compute position on mount and on resize/scroll
    const frame = requestAnimationFrame(computePosition)
    window.addEventListener('resize', computePosition)
    window.addEventListener('scroll', computePosition, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', computePosition)
      window.removeEventListener('scroll', computePosition, true)
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
          <video autoPlay loop muted playsInline className={styles.video}>
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
                className={styles.footerButton}
                onClick={() => prevStep(guideId)}
                aria-label="Back"
              >
                <svg width="18" height="18" viewBox="0 0 88 24" fill="none">
                  <path d="M10 4.927L2.92709 11.9999L10 19.0676L11.5 17.5676L6.92709 12.9999H21V10.9999H6.92709L11.5 6.427L10 4.927Z" fill="currentColor" fillOpacity="0.7"/>
                </svg>
              </button>
            )}
            {!isLastStep && (
              <button
                className={styles.footerButton}
                onClick={() => nextStep(guideId)}
                aria-label="Next"
              >
                <svg width="18" height="18" viewBox="0 0 88 24" fill="none">
                  <path d="M78 4.927L76.5 6.427L81.0677 10.9999H67V12.9999H81.0677L76.5 17.5676L78 19.0676L85.0677 11.9999L78 4.927Z" fill="currentColor" fillOpacity="0.7"/>
                </svg>
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
