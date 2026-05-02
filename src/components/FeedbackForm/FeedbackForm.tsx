import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from '../Modal/Modal'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useDimensions } from '../../hooks/useDimensions'
import { useFeedbackActions } from '../../hooks/useFeedback'
import type { FeedbackType, Page } from '../../types'
import styles from './FeedbackForm.module.css'
import radio from '../../styles/radio.module.css'

interface FeedbackFormProps {
  open: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
}

export function FeedbackForm({ open, onClose, onSuccess }: FeedbackFormProps) {
  const { allPages } = useAutocomplete()
  const dimensions = useDimensions()
  const { addFeedback } = useFeedbackActions()

  const [subjectQuery, setSubjectQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<Page | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [type, setType] = useState<FeedbackType>('positive')
  const [description, setDescription] = useState('')
  const [dimensionId, setDimensionId] = useState<number | undefined>(undefined)

  // Filter pages under any hub for the subject search
  const subjectResults = useMemo(() => {
    if (!subjectQuery.trim()) return []
    const q = subjectQuery.toLowerCase()
    return allPages.filter(
      (p) =>
        p.parentId && p.type !== 'hub' &&
        p.name.toLowerCase().includes(q)
    )
  }, [subjectQuery, allPages])

  // Reset active index when results change
  useEffect(() => { setActiveIndex(-1) }, [subjectResults.length])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !resultsRef.current) return
    const el = resultsRef.current.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleSubjectKeyDown(e: React.KeyboardEvent) {
    if (!subjectResults.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < subjectResults.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : subjectResults.length - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      setSelectedSubject(subjectResults[activeIndex])
      setSubjectQuery('')
    }
  }

  const selectedParentHub = selectedSubject?.parentId ? allPages.find((p) => p.id === selectedSubject.parentId) : undefined
  const isColleague = selectedSubject?.type === 'colleague' || selectedParentHub?.role === 'colleague-hub'

  function reset() {
    setSubjectQuery('')
    setSelectedSubject(null)
    setType('positive')
    setDescription('')
    setDimensionId(undefined)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (!selectedSubject?.id || !description.trim()) return

    await addFeedback({
      subjectId: selectedSubject.id,
      type,
      description: description.trim(),
      dimensionId: isColleague ? dimensionId : undefined,
    })

    reset()
    onClose()
    onSuccess('Feedback added')
  }

  const canSubmit =
    selectedSubject !== null &&
    description.trim().length > 0 &&
    (!isColleague || dimensionId !== undefined)

  return (
    <Modal
      title="Add feedback"
      open={open}
      onClose={handleClose}
      onConfirm={handleSubmit}
      confirmDisabled={!canSubmit}
    >
      {/* Subject */}
      <div className={styles.section}>
        <span className={styles.label}>Subject</span>
        {selectedSubject ? (
          <div className={styles.selectedSubject}>
            <span>
              {selectedParentHub?.mentionTrigger ?? ''}{selectedSubject.name}
            </span>
            <button
              className={styles.clearSubject}
              onClick={() => setSelectedSubject(null)}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : (
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              value={subjectQuery}
              onChange={(e) => setSubjectQuery(e.target.value)}
              onKeyDown={handleSubjectKeyDown}
              placeholder="Look up colleagues or projects"
              autoFocus
              style={subjectQuery ? { paddingRight: 32 } : undefined}
            />
            {subjectQuery && (
              <button className={styles.clearSearch} onClick={() => setSubjectQuery('')} aria-label="Clear">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {subjectResults.length > 0 && (
              <div className={styles.searchResults} ref={resultsRef}>
                {subjectResults.map((page, i) => (
                  <button
                    key={page.id}
                    className={i === activeIndex ? styles.searchResultActive : styles.searchResult}
                    onClick={() => {
                      setSelectedSubject(page)
                      setSubjectQuery('')
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Type */}
      <div className={styles.section}>
        <span className={styles.label}>Type</span>
        <div className={styles.radioRow}>
          {(['positive', 'neutral', 'negative'] as FeedbackType[]).map((t) => (
            <button
              key={t}
              className={radio.radioOption}
              onClick={() => setType(t)}
            >
              <div className={radio.radioCircle} data-checked={type === t} />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className={styles.section}>
        <span className={styles.label}>Description</span>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description..."
        />
      </div>

      {/* Dimension (if colleague) */}
      {isColleague && (
        <div className={styles.section}>
          <span className={styles.label}>Feedback dimension</span>
          <div className={styles.dimensionList}>
            {dimensions.map((dim) => (
              <button
                key={dim.id}
                className={radio.radioOption}
                onClick={() => setDimensionId(dim.id)}
              >
                <div
                  className={radio.radioCircle}
                  data-checked={dimensionId === dim.id}
                />
                {dim.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
