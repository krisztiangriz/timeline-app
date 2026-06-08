import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from '../Modal/Modal'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useHubFeedbackProperties } from '../../hooks/useHubProperties'
import { addFeedback } from '../../hooks/useFeedback'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/database'
import { CloseIcon, SearchIcon, PlusIcon } from '../Icons/Icons'
import { DropdownPortal } from '../DropdownPortal/DropdownPortal'
import type { Page } from '../../types'
import { makeRadioKeyHandler } from '../../utils/radioKeyHandler'
import styles from './FeedbackModal.module.css'
import radio from '../../styles/radio.module.css'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  /** Callback to show a toast message (used for both success and error feedback) */
  onSuccess: (msg: string) => void
}

export function FeedbackModal({ open, onClose, onSuccess }: FeedbackModalProps) {
  const { allPages } = useAutocomplete()
  const allHubProperties = useLiveQuery(() => db.hubProperties.toArray(), []) ?? []

  // Hub IDs that have at least one feedback-scoped property
  const hubsWithFeedback = useMemo(() => {
    return new Set(allHubProperties.filter((p) => p.scope === 'feedback').map((p) => p.hubId))
  }, [allHubProperties])

  const hubsKey = useMemo(() => [...hubsWithFeedback].sort().join(','), [hubsWithFeedback])

  // Page IDs that have a feedback block — query by type index on pageId scoped to known hubs
  const feedbackPageIds = useLiveQuery(async () => {
    // Get child pages of hubs with feedback config, then check their blocks
    const hubIds = [...hubsWithFeedback]
    if (hubIds.length === 0) return new Set<number>()
    const childPages = await db.pages.where('parentId').anyOf(hubIds).toArray()
    const childPageIds = childPages.map((p) => p.id!)
    if (childPageIds.length === 0) return new Set<number>()
    const blocks = await db.blocks.where('pageId').anyOf(childPageIds).filter((b) => b.type === 'feedback').toArray()
    return new Set(blocks.map((b) => b.pageId))
  }, [hubsKey]) ?? new Set<number>()

  // Pages searchable for feedback (under hubs with feedback config AND have a feedback block)
  const searchablePages = useMemo(() => {
    return allPages.filter((p) => p.parentId && hubsWithFeedback.has(p.parentId) && feedbackPageIds.has(p.id!))
  }, [allPages, hubsWithFeedback, feedbackPageIds])

  const [subjectQuery, setSubjectQuery] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<Page[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const resultsRef = useRef<HTMLDivElement>(null)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const [description, setDescription] = useState('')
  const [propertyValues, setPropertyValues] = useState<Record<number, string>>({})

  // Determine the hub context from selected subjects
  const primaryHub = useMemo(() => {
    if (selectedSubjects.length === 0) return undefined
    const first = selectedSubjects[0]
    return first.parentId ? allPages.find((p) => p.id === first.parentId) : undefined
  }, [selectedSubjects, allPages])

  const feedbackProperties = useHubFeedbackProperties(primaryHub?.id)

  // Filter search results
  const subjectResults = useMemo(() => {
    if (!subjectQuery.trim()) return []
    const q = subjectQuery.toLowerCase()
    const selectedIds = new Set(selectedSubjects.map((s) => s.id))
    return searchablePages.filter(
      (p) => !selectedIds.has(p.id) && p.name.toLowerCase().includes(q)
    )
  }, [subjectQuery, searchablePages, selectedSubjects])

  useEffect(() => { setActiveIndex(-1) }, [subjectResults.length])
  useEffect(() => {
    if (activeIndex < 0 || !resultsRef.current) return
    const el = resultsRef.current.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleSubjectKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && subjectResults.length) {
      e.preventDefault()
      e.stopPropagation()
      setSubjectQuery('')
      return
    }
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

  function setPropertyValue(propertyId: number, value: string) {
    setPropertyValues((prev) => ({ ...prev, [propertyId]: value }))
  }

  function reset() {
    setSubjectQuery('')
    setSelectedSubjects([])
    setDescription('')
    setPropertyValues({})
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (selectedSubjects.length === 0 || !description.trim()) return

    try {
      const firstProp = feedbackProperties[0]
      const secondProp = feedbackProperties[1]
      const type = firstProp ? (propertyValues[firstProp.id!] || firstProp.options[0]?.value || '') : ''
      const dimValue = secondProp ? propertyValues[secondProp.id!] : undefined

      for (const subject of selectedSubjects) {
        await addFeedback({
          subjectId: subject.id!,
          type,
          description: description.trim(),
          dimensionId: dimValue || undefined,
        })
      }

      reset()
      onClose()
      onSuccess('Feedback added')
    } catch {
      onClose()
      onSuccess('Failed to add feedback')
    }
  }

  const canSubmit = selectedSubjects.length > 0 && description.trim().length > 0

  return (
    <Modal
      title="Add feedback"
      open={open}
      onClose={handleClose}
      onConfirm={handleSubmit}
      confirmDisabled={!canSubmit}
    >
      {/* Subject lookup */}
      <div className={styles.section}>
        <span className={styles.label}>Subject</span>
        <div className={styles.searchWrapper} ref={searchWrapperRef}>
          <SearchIcon />
          <input
            className={styles.searchInput}
            type="text"
            value={subjectQuery}
            onChange={(e) => setSubjectQuery(e.target.value)}
            onKeyDown={handleSubjectKeyDown}
            placeholder={selectedSubjects.length > 0 ? 'Add another...' : 'Look up pages...'}
            autoFocus={selectedSubjects.length === 0}
            aria-label="Subject"
          />
          {subjectQuery && (
            <button className={styles.clearSearch} onClick={() => setSubjectQuery('')} aria-label="Clear" tabIndex={0}>
              <PlusIcon size={12} />
            </button>
          )}
        </div>
        <DropdownPortal anchorRef={searchWrapperRef} open={subjectResults.length > 0}>
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
        </DropdownPortal>
        {selectedSubjects.length > 0 && (
          <div className={styles.subjectChips}>
            {selectedSubjects.map((s) => {
              const hub = s.parentId ? allPages.find((p) => p.id === s.parentId) : undefined
              return (
                <div key={s.id} className={styles.subjectChip}>
                  <span>
                    {hub?.mentionTrigger && <span className={styles.triggerChar}>{hub.mentionTrigger}</span>}
                    {s.name}
                  </span>
                  <button className={styles.chipRemove} onClick={() => handleRemoveSubject(s.id!)} aria-label={`Remove ${s.name}`} tabIndex={0}>
                    <CloseIcon size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Description */}
      <div className={styles.section}>
        <span className={styles.label}>Description</span>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter feedback..."
          aria-label="Description"
        />
      </div>

      {/* Feedback properties — rendered generically from hub config */}
      {feedbackProperties.map((prop, index) => (
        <div key={prop.id} className={styles.section}>
          <span className={styles.label}>{prop.name}</span>
          {(() => {
            const optValues = prop.options.map((o) => o.value)
            const currentVal = propertyValues[prop.id!] || (index === 0 ? prop.options[0]?.value : '')
            return (
              <div
                className={prop.options.length > 3 ? styles.optionsVertical : styles.optionsRow}
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
  )
}
