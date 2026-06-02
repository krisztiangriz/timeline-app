import { Modal } from '../Modal/Modal'
import styles from './ConfirmModal.module.css'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmModal({ open, title, message, onClose, onConfirm }: ConfirmModalProps) {
  return (
    <Modal title={title} open={open} onClose={onClose} onConfirm={onConfirm} compact hideClose zIndex={101} descriptionId="confirm-message">
      <p className={styles.message} id="confirm-message">{message}</p>
    </Modal>
  )
}
