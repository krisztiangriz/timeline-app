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
    <Modal title="Welcome to Timeline" open={open} onClose={handleGetStarted} hideFooter>
      <div className={styles.content}>
        {/* Video */}
        <video
          className={styles.media}
          autoPlay
          loop
          muted
          playsInline
          onTimeUpdate={(e) => {
            const v = e.currentTarget
            if (v.duration - v.currentTime < 0.1) {
              v.currentTime = 0
            }
          }}
        >
          <source src="/timeline-app/timeline-app-promo.mp4" type="video/mp4" />
        </video>

        {/* Description text — replace with your copy */}
        <p className={styles.description}>
          Timeline is a clever, privacy focused progressive web todo app, that collects tagged input and visualizes data.
        </p>

        {/* Get Started button */}
        <button className={styles.getStartedButton} onClick={handleGetStarted}>
          Get Started
        </button>
      </div>
    </Modal>
  )
}
