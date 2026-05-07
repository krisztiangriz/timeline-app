import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from '../Modal/Modal'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useDimensions } from '../../hooks/useDimensions'
import { addFeedback } from '../../hooks/useFeedback'
import { CloseIcon, SearchIcon, PlusIcon } from '../Icons/Icons'
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

  const [subjectQuery, setSubjectQuery] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<Page[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [type, setType] = useState<FeedbackType>('positive')
  const [description, setDescription] = useState('')
  const [dimensionId, setDimensionId] = useState<number | undefined>(undefined)

  // Filter pages under any hub for the subject search — exclude already selected
  const subjectResults = useMemo(() => {
    if (!subjectQuery.trim()) return []
    const q = subjectQuery.toLowerCase()
    const selectedIds = new Set(selectedSubjects.map((s) => s.id))
    return allPages.filter(
      (p) =>
        p.parentId && p.type !== 'hub' &&
        !selectedIds.has(p.id) &&
        p.name.toLowerCase().includes(q)
    )
  }, [subjectQuery, allPages, selectedSubjects])

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
      handleSelectSubject(subjectResults[activeIndex])
    }
  }

  function handleSelectSubject(page: Page) {
    setSelectedSubjects((prev) => [...prev, page])
    setSubjectQuery('')
  }

  function handleRemoveSubject(pageId: number) {
    setSelectedSubjects((prev) => prev.filter((p) => p.id !== pageId))
  }

  // Show dimension field if ANY selected subject is a colleague
  const isColleague = selectedSubjects.some((s) => {
    const hub = s.parentId ? allPages.find((p) => p.id === s.parentId) : undefined
    return s.type === 'colleague' || hub?.role === 'colleague-hub'
  })

  function reset() {
    setSubjectQuery('')
    setSelectedSubjects([])
    setType('positive')
    setDescription('')
    setDimensionId(undefined)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (selectedSubjects.length === 0 || !description.trim()) return

    for (const subject of selectedSubjects) {
      await addFeedback({
        subjectId: subject.id!,
        type,
        description: description.trim(),
        dimensionId: isColleague ? dimensionId : undefined,
      })
    }

    reset()
    onClose()
    onSuccess('Feedback added')
  }

  const canSubmit =
    selectedSubjects.length > 0 &&
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
        {/* Selected subjects as chips */}
        {selectedSubjects.length > 0 && (
          <div className={styles.subjectChips}>
            {selectedSubjects.map((s) => {
              const hub = s.parentId ? allPages.find((p) => p.id === s.parentId) : undefined
              return (
                <div key={s.id} className={styles.subjectChip}>
                  <span>
                    {hub?.mentionTrigger && <span style={{ fontFamily: "ui-monospace, 'SF Mono', Monaco, 'Cascadia Mono', monospace" }}>{hub.mentionTrigger}</span>}
                    {s.name}
                  </span>
                  <button className={styles.chipRemove} onClick={() => handleRemoveSubject(s.id!)}>
                    <CloseIcon size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {/* Search input — always visible for adding more */}
        <div className={styles.searchWrapper}>
          <SearchIcon />
          <input
            className={styles.searchInput}
            type="text"
            value={subjectQuery}
            onChange={(e) => setSubjectQuery(e.target.value)}
            onKeyDown={handleSubjectKeyDown}
            placeholder={selectedSubjects.length > 0 ? 'Add another...' : 'Look up colleagues or projects'}
            autoFocus={selectedSubjects.length === 0}
          />
          {subjectQuery && (
            <button className={styles.clearSearch} onClick={() => setSubjectQuery('')} aria-label="Clear">
              <PlusIcon size={12} />
            </button>
          )}
          {subjectResults.length > 0 && (
            <div className={styles.searchResults} ref={resultsRef}>
              {subjectResults.map((page, i) => (
                <button
                  key={page.id}
                  className={i === activeIndex ? styles.searchResultActive : styles.searchResult}
                  onClick={() => handleSelectSubject(page)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {page.name}
                </button>
              ))}
            </div>
          )}
        </div>
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

      {/* Dimension (if any selected subject is a colleague) */}
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
