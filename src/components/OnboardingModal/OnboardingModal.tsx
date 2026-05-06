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
        {/* Media placeholder — replace with your video/gif/image */}
        <div className={styles.mediaPlaceholder}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className={styles.mediaIcon}>
            <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="8.5" cy="10.5" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M22 16l-5.5-5.5L4 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10 8l5 4 5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
          </svg>
          <span className={styles.mediaLabel}>Video or image placeholder</span>
        </div>

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
