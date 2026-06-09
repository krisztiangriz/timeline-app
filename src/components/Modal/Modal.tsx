import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { CloseIcon, CheckIcon } from '../Icons/Icons'
import { lastMenuAnchorRef } from '../ContextMenu/ContextMenu'
import styles from './Modal.module.css'

// Reference-count open modals so nested modals don't prematurely restore scroll
let openModalCount = 0
function lockScroll() {
  if (openModalCount++ === 0) document.body.style.overflow = 'hidden'
}
function unlockScroll() {
  if (--openModalCount <= 0) { openModalCount = 0; document.body.style.overflow = '' }
}

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
  zIndex?: number
  descriptionId?: string
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
  zIndex,
  descriptionId,
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
        const inInteractive = active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          active?.tagName === 'SELECT' ||
          active?.tagName === 'BUTTON' ||
          (active as HTMLElement)?.isContentEditable
        if (inInteractive) return
        e.preventDefault()
        onConfirm()
      }

      // Focus trap — always active when modal is open
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const isInsideModal = modalRef.current.contains(document.activeElement)
        if (e.shiftKey) {
          if (!isInsideModal || document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (!isInsideModal || document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    window.addEventListener('keydown', handler)

    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, onConfirm, confirmDisabled])

  // Auto-focus first focusable element when modal opens (once per open)
  const didAutoFocus = useRef(false)
  useEffect(() => {
    if (open && !didAutoFocus.current && modalRef.current) {
      const first = modalRef.current.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
      didAutoFocus.current = true
    }
    if (!open) didAutoFocus.current = false
  }, [open])

  // Capture trigger element synchronously before auto-focus moves focus into the modal
  const triggerRef = useRef<Element | null>(null)
  useLayoutEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement
    }
  }, [open])
  useEffect(() => {
    if (!open && triggerRef.current instanceof HTMLElement) {
      const anchor = lastMenuAnchorRef.current
      const target = document.contains(triggerRef.current)
        ? triggerRef.current
        : (anchor && document.contains(anchor) ? anchor : null)
      target?.focus()
      lastMenuAnchorRef.current = null
      triggerRef.current = null
    }
  }, [open])

  // Prevent body scroll when modal is open (reference-counted for nested modals)
  useEffect(() => {
    if (!open) return
    lockScroll()
    return unlockScroll
  }, [open])

  if (!open) return null

  return (
    <div className={styles.overlay} style={zIndex ? { zIndex } : undefined} onClick={onClose}>
      <div ref={modalRef} className={compact ? `${styles.modal} ${styles.modalCompact}` : styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={descriptionId}>
        <div className={scrolledTop ? styles.headerBorder : styles.header}>
          <h1 className={styles.title} id="modal-title">{title}</h1>
          {!hideClose && (
            <button className={styles.closeButton} onClick={onClose} aria-label="Close" tabIndex={0}>
              <CloseIcon />
            </button>
          )}
        </div>

        <div className={styles.body} ref={bodyRef} onScroll={checkOverflow}>{children}</div>

        {!hideFooter && (
          <div className={scrolledBottom ? styles.footerBorder : styles.footer}>
            <button className={styles.footerButton} onClick={onClose} aria-label="Cancel" tabIndex={0}>
              <CloseIcon />
            </button>
            {onConfirm && (
              <button
                className={styles.footerButton}
                onClick={onConfirm}
                disabled={confirmDisabled}
                aria-label="Confirm"
                tabIndex={0}
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
