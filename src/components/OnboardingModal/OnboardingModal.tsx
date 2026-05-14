import { useEffect, useRef } from 'react'
import { Modal } from '../Modal/Modal'
import styles from './OnboardingModal.module.css'

interface OnboardingModalProps {
  open: boolean
  onClose: () => void
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  // Reset any state when opened
  const prevOpen = useRef(false)
  useEffect(() => {
    prevOpen.current = open
  }, [open])

  function handleGetStarted() {
    localStorage.setItem('onboarding-completed', 'true')
    onClose()
  }

  return (
    <Modal title="Welcome to Timeline" open={open} onClose={handleGetStarted} hideFooter hideClose compact>
      <div className={styles.content}>
        {/* Video */}
        <video
          className={styles.media}
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/timeline-app/timeline-app-promo.mp4" type="video/mp4" />
        </video>

        {/* Description text — replace with your copy */}
        <p className={styles.description}>
          Timeline is a privacy focused, minimal progressive web app where you can capture, organize and visualize your work.
        </p>

        {/* Get Started button */}
        <button className={styles.getStartedButton} onClick={handleGetStarted}>
          Get Started
        </button>
      </div>
    </Modal>
  )
}
