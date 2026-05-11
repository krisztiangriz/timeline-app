import styles from './EmptyState.module.css'

interface EmptyStateProps {
  message: string
  compact?: boolean
}

export function EmptyState({ message, compact }: EmptyStateProps) {
  return <div className={compact ? styles.emptyStateCompact : styles.emptyState}>{message}</div>
}
