import styles from './EmptyState.module.css'

interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return <div className={styles.emptyState}>{message}</div>
}
