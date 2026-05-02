import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { CloseIcon, CheckIcon } from '../Icons/Icons'
import styles from './Modal.module.css'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  onConfirm?: () => void
  children: ReactNode
  confirmDisabled?: boolean
}

export function Modal({
  title,
  open,
  onClose,
  onConfirm,
  children,
  confirmDisabled,
}: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [scrolledTop, setScrolledTop] = useState(false)
  const [scrolledBottom, setScrolledBottom] = useState(false)

  const checkOverflow = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    setScrolledTop(el.scrollTop > 0)
    setScrolledBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    if (!open) return
    // Check on open and after content renders
    const frame = requestAnimationFrame(checkOverflow)
    return () => cancelAnimationFrame(frame)
  }, [open, children, checkOverflow])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return

      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Enter' && onConfirm && !confirmDisabled) {
        const active = document.activeElement
        const inFormControl = active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          active?.tagName === 'SELECT' ||
          (active as HTMLElement)?.isContentEditable
        if (inFormControl) return
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, onConfirm, confirmDisabled])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={scrolledTop ? styles.headerBorder : styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body} ref={bodyRef} onScroll={checkOverflow}>{children}</div>

        <div className={scrolledBottom ? styles.footerBorder : styles.footer}>
          <button className={styles.footerButton} onClick={onClose} aria-label="Cancel">
            <CloseIcon />
          </button>
          {onConfirm && (
            <button
              className={styles.footerButton}
              onClick={onConfirm}
              disabled={confirmDisabled}
              aria-label="Confirm"
              style={{ opacity: confirmDisabled ? 0.4 : 1 }}
            >
              <CheckIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
