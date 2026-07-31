import { useState, useRef, useEffect, useCallback } from 'react'
import { Modal } from '../Modal/Modal'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'
import { addEntry } from '../../hooks/useTimeline'
import { startOfDay } from '../../utils/dateUtils'
import { stripHtml } from '../../utils/stripHtml'
import styles from './AddHistoricEntryModal.module.css'

function parseHistoricDate(value: string): Date | null {
  const d = new Date(value + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  if (d >= startOfDay(new Date())) return null
  return d
}

interface AddHistoricEntryModalProps {
  open: boolean
  onClose: () => void
  pageId: number
  onToast: (msg: string) => void
}

export function AddHistoricEntryModal({ open, onClose, pageId, onToast }: AddHistoricEntryModalProps) {
  const [dateValue, setDateValue] = useState('')
  const [html, setHtml] = useState('')
  const [dateError, setDateError] = useState(false)

  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDateValue('')
      setHtml('')
      setDateError(false)
    }
    prevOpenRef.current = open
  }, [open])

  const parsedDate = parseHistoricDate(dateValue)
  const hasContent = stripHtml(html).trim().length > 0
  const canConfirm = parsedDate !== null && hasContent

  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDateValue(e.target.value)
    setDateError(false)
  }, [])

  const handleDateBlur = useCallback(() => {
    if (dateValue && !parseHistoricDate(dateValue)) {
      setDateError(true)
    }
  }, [dateValue])

  async function handleConfirm() {
    if (!parsedDate) return
    try {
      await addEntry({ pageId, text: html, isPending: false, date: parsedDate })
      onClose()
    } catch {
      onToast('Failed to add entry')
    }
  }

  return (
    <Modal title="Add past entry" open={open} onClose={onClose} onConfirm={handleConfirm} confirmDisabled={!canConfirm}>
      <div className={styles.form}>
        <div className={styles.section}>
          <span className={styles.label}>When</span>
          <input
            className={`${styles.textInput} ${dateError ? styles.textInputError : ''}`}
            type="text"
            placeholder="YYYY-MM-DD"
            aria-label="When"
            value={dateValue}
            onChange={handleDateChange}
            onBlur={handleDateBlur}
          />
        </div>
        <div className={styles.section}>
          <span className={styles.label}>What</span>
          <div className={styles.editorContainer}>
            <RichTextEditor
              value={html}
              onChange={setHtml}
              placeholder="What happened?"
              collapseMentions
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
