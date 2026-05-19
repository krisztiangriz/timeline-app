import { useEffect, useRef, useState, useCallback } from 'react'
import { CloseIcon, CheckIcon } from '../Icons/Icons'
import styles from './Modal.module.css'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  onConfirm?: () => void
  children: React.ReactNode
  confirmDisabled?: boolean
  hideFooter?: boolean
  hideClose?: boolean
  compact?: boolean
}

export function Modal({
  title,
  open,
  onClose,
  onConfirm,
  children,
  confirmDisabled,
  hideFooter,
  hideClose,
  compact,
}: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
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

  // Keyboard handling: Escape, Enter, focus trap
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

      // Focus trap (skip for modals without close button, e.g., onboarding)
      if (e.key === 'Tab' && !hideClose && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handler)

    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, onConfirm, confirmDisabled, hideClose])

  // Auto-focus first focusable element when modal opens (once per open)
  const didAutoFocus = useRef(false)
  useEffect(() => {
    if (open && !didAutoFocus.current && !hideClose && modalRef.current) {
      const first = modalRef.current.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), button:not([disabled])'
      )
      first?.focus()
      didAutoFocus.current = true
    }
    if (!open) didAutoFocus.current = false
  }, [open, hideClose])

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
      <div ref={modalRef} className={compact ? `${styles.modal} ${styles.modalCompact}` : styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={scrolledTop ? styles.headerBorder : styles.header}>
          <h1 className={styles.title} id="modal-title">{title}</h1>
          {!hideClose && (
            <button className={styles.closeButton} onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          )}
        </div>

        <div className={styles.body} ref={bodyRef} onScroll={checkOverflow}>{children}</div>

        {!hideFooter && (
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
        )}
      </div>
    </div>
  )
}
