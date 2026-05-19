import type { ToastMessage } from '../../hooks/useToast'
import styles from './Toast.module.css'

interface ToastContainerProps {
  toasts: ToastMessage[]
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className={styles.container} aria-live="polite" role="status">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          {toast.text}
        </div>
      ))}
    </div>
  )
}
