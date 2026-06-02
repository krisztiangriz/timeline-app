import { useState, useMemo, memo } from 'react'
import { makeRadioKeyHandler } from '../../utils/radioKeyHandler'
import { Modal } from '../Modal/Modal'
import { useFeedbackForSubject, addFeedback, updateFeedback, deleteFeedback } from '../../hooks/useFeedback'
import { useHubFeedbackProperties } from '../../hooks/useHubProperties'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useToast } from '../../hooks/useToast'
import { formatTableDate } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState/EmptyState'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { RichTextDisplay } from '../RichTextEditor/RichTextDisplay'
import { PlusIcon } from '../Icons/Icons'
import { RangeToggle, type RangeMonths } from '../RangeToggle/RangeToggle'
import styles from './PageDetail.module.css'
import radio from '../../styles/radio.module.css'

interface FeedbackListProps {
  subjectId: number
}

export const FeedbackList = memo(function FeedbackList({ subjectId }: FeedbackListProps) {
  const feedbacks = useFeedbackForSubject(subjectId)
  const { allPages } = useAutocomplete()
  const { show: showToast } = useToast()

  // Range filter state
  const [range, setRange] = useState<RangeMonths>(0)

  const filteredFeedbacks = useMemo(() => {
    if (range === 0) return feedbacks
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth() - range, now.getDate())
    return feedbacks.filter((fb) => new Date(fb.createdAt) >= cutoff)
  }, [feedbacks, range])

  // Find the hub for this subject to get feedback properties
  const subjectPage = allPages.find((p) => p.id === subjectId)
  const hub = subjectPage?.parentId ? allPages.find((p) => p.id === subjectPage.parentId) : undefined
  const feedbackProperties = useHubFeedbackProperties(hub?.id)

  // First property → maps to Feedback.type, Second → maps to Feedback.dimensionId
  const firstProperty = feedbackProperties[0]
  const secondProperty = feedbackProperties[1]

  // Build second property lookup from property options (value is stored as string ID)
  const dimMap = useMemo(() => {
    if (!secondProperty) return new Map<string, { name: string; color?: string }>()
    return new Map(secondProperty.options.map((o) => [o.value, { name: o.label, color: o.color }]))
  }, [secondProperty])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDescription, setModalDescription] = useState('')
  const [modalPropertyValues, setModalPropertyValues] = useState<Record<number, string>>({})

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editHtml, setEditHtml] = useState('')

  function startEdit(id: number, description: string) {
    setEditingId(id)
    setEditHtml(description)
  }

  async function handleSave() {
    if (editingId === null) return
    const trimmed = editHtml.trim()
    if (!trimmed || trimmed === '<br>') {
      await deleteFeedback(editingId)
    } else {
      await updateFeedback(editingId, { description: trimmed })
    }
    setEditingId(null)
    setEditHtml('')
  }

  function openModal() {
    setModalDescription('')
    setModalPropertyValues({})
    setModalOpen(true)
  }

  async function handleModalSubmit() {
    const trimmed = modalDescription.trim()
    if (!trimmed) return

    try {
      const type = firstProperty
        ? (modalPropertyValues[firstProperty.id!] || firstProperty.options[0]?.value || '')
        : ''
      const dimValue = secondProperty ? modalPropertyValues[secondProperty.id!] : undefined

      await addFeedback({
        subjectId,
        type,
        description: trimmed,
        dimensionId: dimValue || undefined,
      })

      setModalOpen(false)
      setModalDescription('')
      setModalPropertyValues({})
    } catch {
      showToast('Failed to save feedback')
    }
  }

  function setPropertyValue(propertyId: number, value: string) {
    setModalPropertyValues((prev) => ({ ...prev, [propertyId]: value }))
  }

  return (
    <div className={styles.feedbackList}>
      {/* Header with range toggle and add button */}
      <div className={styles.feedbackListHeader}>
        <RangeToggle value={range} onChange={setRange} />
        <button className={styles.feedbackAddButton} onClick={openModal} aria-label="Add feedback">
          <PlusIcon />
        </button>
      </div>

      {/* Feedback items */}
      {filteredFeedbacks.length === 0 && (
        <EmptyState message="Click + to add feedback" />
      )}
      {filteredFeedbacks.map((fb) => {
        const dim = fb.dimensionId ? dimMap.get(String(fb.dimensionId)) : undefined
        const typeOption = firstProperty?.options.find((o) => o.value === fb.type)

        return (
          <div key={fb.id} className={styles.feedbackItem}>
            <div className={styles.feedbackHeader}>
              <span className={styles.feedbackDate}>
                {formatTableDate(new Date(fb.createdAt))}
              </span>
              {typeOption && (
                <>
                  <div className={styles.feedbackSeparator} />
                  <span className={styles.feedbackDimension}>{typeOption.label}</span>
                </>
              )}
              {dim && (
                <>
                  <div className={styles.feedbackSeparator} />
                  <span className={styles.feedbackDimension}>{dim.name}</span>
                </>
              )}
              <button
                className={styles.feedbackDeleteButton}
                onClick={() => deleteFeedback(fb.id!)}
                aria-label="Delete feedback"
              >
                Delete
              </button>
            </div>
            {editingId === fb.id ? (
              <RichTextEditor
                value={editHtml}
                onChange={setEditHtml}
                onBlur={handleSave}
                onEnter={handleSave}
                autoFocus
                className={styles.feedbackRichInput}
              />
            ) : (
              <RichTextDisplay
                html={fb.description}
                onClick={() => startEdit(fb.id!, fb.description)}
                className={styles.feedbackDescription}
              />
            )}
          </div>
        )
      })}

      {/* Add feedback modal */}
      <Modal
        title="Add feedback"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleModalSubmit}
        confirmDisabled={!modalDescription.trim()}
      >
        {/* Description */}
        <div className={styles.feedbackModalSection}>
          <span className={styles.feedbackModalLabel}>Description</span>
          <textarea
            className={styles.feedbackModalTextarea}
            value={modalDescription}
            onChange={(e) => setModalDescription(e.target.value)}
            placeholder="Enter feedback..."
            autoFocus
          />
        </div>

        {/* Feedback properties — rendered generically */}
        {feedbackProperties.map((prop, index) => (
          <div key={prop.id} className={styles.feedbackModalSection}>
            <span className={styles.feedbackModalLabel}>{prop.name}</span>
            {(() => {
              const optValues = prop.options.map((o) => o.value)
              const currentVal = modalPropertyValues[prop.id!] || (index === 0 ? prop.options[0]?.value : '')
              return (
                <div
                  className={prop.options.length > 3 ? styles.feedbackModalOptionsVertical : styles.feedbackModalOptions}
                  role="radiogroup"
                  aria-label={prop.name}
                  onKeyDown={makeRadioKeyHandler(optValues, currentVal, (v) => setPropertyValue(prop.id!, v))}
                >
                  {prop.options.map((opt, optIdx) => {
                    const isSelected = currentVal === opt.value
                    const noneSelected = !optValues.includes(currentVal)
                    return (
                      <button
                        key={opt.value}
                        className={radio.radioOption}
                        onClick={() => setPropertyValue(prop.id!, opt.value)}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={isSelected || (noneSelected && optIdx === 0) ? 0 : -1}
                      >
                        <div className={radio.radioCircle} data-checked={isSelected} />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        ))}
      </Modal>
    </div>
  )
})
