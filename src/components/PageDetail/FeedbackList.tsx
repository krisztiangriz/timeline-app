import { useState, useMemo } from 'react'
import { useFeedbackForSubject, updateFeedback, deleteFeedback } from '../../hooks/useFeedback'
import { useDimensions } from '../../hooks/useDimensions'
import { formatTableDate } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState/EmptyState'
import { TrashIcon } from '../Icons/Icons'
import styles from './PageDetail.module.css'

interface FeedbackListProps {
  subjectId: number
}

export function FeedbackList({ subjectId }: FeedbackListProps) {
  const feedbacks = useFeedbackForSubject(subjectId)
  const dimensions = useDimensions()
  const dimMap = useMemo(() => new Map(dimensions.map((d) => [d.id!, d])), [dimensions])

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  function startEdit(id: number, description: string) {
    setEditingId(id)
    setEditText(description)
  }

  async function handleSave() {
    if (editingId === null) return
    const trimmed = editText.trim()
    if (!trimmed) {
      await deleteFeedback(editingId)
    } else {
      await updateFeedback(editingId, { description: trimmed })
    }
    setEditingId(null)
    setEditText('')
  }

  if (feedbacks.length === 0) {
    return <EmptyState message="No feedback yet" />
  }

  return (
    <div className={styles.feedbackList}>
      {feedbacks.map((fb) => {
        const dim = fb.dimensionId
          ? dimMap.get(fb.dimensionId)
          : undefined

        return (
          <div key={fb.id} className={styles.feedbackItem}>
            <div className={styles.feedbackHeader}>
              <span className={styles.feedbackDate}>
                {formatTableDate(new Date(fb.createdAt))}
              </span>
              {dim && (
                <>
                  <div className={styles.feedbackSeparator} />
                  <span className={styles.feedbackDimension}>{dim.name}</span>
                </>
              )}
              {fb.type === 'positive' && (
                <div className={styles.feedbackIndicatorPositive} />
              )}
              {fb.type === 'neutral' && (
                <div className={styles.feedbackIndicatorNeutral} />
              )}
              {fb.type === 'negative' && (
                <div className={styles.feedbackIndicatorNegative} />
              )}
              <button
                className={styles.feedbackDeleteButton}
                onClick={() => deleteFeedback(fb.id!)}
                aria-label="Delete feedback"
              >
                <TrashIcon />
              </button>
            </div>
            {editingId === fb.id ? (
              <textarea
                className={styles.feedbackEditTextarea}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
                  if (e.key === 'Escape') { setEditingId(null); setEditText('') }
                }}
                autoFocus
              />
            ) : (
              <span
                className={styles.feedbackDescription}
                onClick={() => startEdit(fb.id!, fb.description)}
                style={{ cursor: 'text' }}
              >
                {fb.description}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
