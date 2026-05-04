import { useState } from 'react'
import { Modal } from '../Modal/Modal'
import { purgeDemoData } from '../../utils/demoData'
import styles from './DemoBanner.module.css'

interface DemoBannerProps {
  onExitDemo: () => void
}

export function DemoBanner({ onExitDemo }: DemoBannerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [purging, setPurging] = useState(false)

  async function handleConfirmExit() {
    setPurging(true)
    try {
      await purgeDemoData()
      onExitDemo()
      window.location.reload()
    } catch {
      setPurging(false)
    }
  }

  return (
    <>
      <div className={styles.banner}>
        <div className={styles.bannerInner}>
          <span className={styles.text}>
            You're viewing demo data — explore freely, nothing is saved permanently.
          </span>
          <button className={styles.exitButton} onClick={() => setConfirmOpen(true)}>
            Exit Demo
          </button>
        </div>
      </div>
      <div className={styles.spacer} />

      <Modal
        title="Exit demo mode?"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmExit}
        confirmDisabled={purging}
      >
        <p style={{
          fontSize: 'var(--font-size-base)',
          lineHeight: 'var(--line-height-base)',
          color: 'var(--color-text-body)',
        }}>
          All demo data will be permanently deleted and the app will start fresh.
          This cannot be undone.
        </p>
      </Modal>
    </>
  )
}
