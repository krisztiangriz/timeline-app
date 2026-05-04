import { useMemo } from 'react'
import { useFeedbackForSubject } from '../../hooks/useFeedback'
import { useDimensions } from '../../hooks/useDimensions'
import { formatTableDate } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState/EmptyState'
import styles from './PageDetail.module.css'

interface FeedbackListProps {
  subjectId: number
}

export function FeedbackList({ subjectId }: FeedbackListProps) {
  const feedbacks = useFeedbackForSubject(subjectId)
  const dimensions = useDimensions()
  const dimMap = useMemo(() => new Map(dimensions.map((d) => [d.id!, d])), [dimensions])

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
            </div>
            <span className={styles.feedbackDescription}>{fb.description}</span>
          </div>
        )
      })}
    </div>
  )
}
