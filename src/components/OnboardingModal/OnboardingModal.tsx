import { useState, useRef, useCallback, useEffect, useMemo, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../Modal/Modal'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { usePageByRole } from '../../hooks/usePages'
import { useTimelineActions } from '../../hooks/useTimeline'
import styles from './OnboardingModal.module.css'

interface OnboardingModalProps {
  open: boolean
  onClose: () => void
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Welcome                                                  */
/* ------------------------------------------------------------------ */

function StepWelcome() {
  return (
    <div className={styles.stepContent}>
      <p className={styles.description}>
        Your personal workspace for tracking project progress, colleague interactions, and ideas.
      </p>

      <div className={styles.featureList}>
        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M7.5875 6.5875C7.97917 6.19583 8.45 6 9 6H19C19.55 6 20.0208 6.19583 20.4125 6.5875C20.8042 6.97917 21 7.45 21 8V20C21 20.55 20.8042 21.0208 20.4125 21.4125C20.0208 21.8042 19.55 22 19 22L9 22C8.45 22 7.97917 21.8042 7.5875 21.4125C7.19583 21.0208 7 20.55 7 20V17H9V20H19V8H9V11H7V8C7 7.45 7.19583 6.97917 7.5875 6.5875ZM3.5875 2.5875C3.97917 2.19583 4.45 2 5 2H16V4H5V18H3V4C3 3.45 3.19583 2.97917 3.5875 2.5875Z" fill="currentColor" fillOpacity="0.7"/>
              <path d="M11.6 11.425L13 10L17 14L13 18L11.6 16.6L13.175 15H7V13H13.175L11.6 11.425Z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
          </div>
          <div className={styles.featureText}>
            <span className={styles.featureLabel}>Hubs & Pages</span>
            <span className={styles.featureDesc}>
              Organise by Colleagues, Candidates, and Projects. Hubs group related pages together.
            </span>
          </div>
        </div>

        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 3C3.90625 3 3 3.90625 3 5V9H5V5H9V3H5ZM15 3V5H19V9H21V5C21 3.90625 20.0938 3 19 3H15ZM3 15V19C3 20.0938 3.90625 21 5 21H9V19H5V15H3ZM19 15V19H15V21H19C20.0938 21 21 20.0938 21 19V15H19Z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
          </div>
          <div className={styles.featureText}>
            <span className={styles.featureLabel}>Composable Blocks</span>
            <span className={styles.featureDesc}>
              Build pages with timeline entries, feedback, charts, and rich text.
              Type <span className={styles.kbd}>~</span> in the editor to insert a block.
            </span>
          </div>
        </div>

        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M10.707 16.707L5.70703 21.707L4.29297 20.293L9.29297 15.293L10.707 16.707Z" fill="currentColor" fillOpacity="0.7"/>
              <path d="M17.707 8.29297L16.293 9.70703L13 6.41406V13.5859L19.707 20.293L18.293 21.707L11 14.4141V6.41406L7.70703 9.70703L6.29297 8.29297L12 2.58594L17.707 8.29297Z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
          </div>
          <div className={styles.featureText}>
            <span className={styles.featureLabel}>Keyboard Shortcuts</span>
            <span className={styles.featureDesc}>
              <span className={styles.kbd}>Ctrl+Shift+K</span> search&ensp;
              <span className={styles.kbd}>Ctrl+Shift+F</span> feedback&ensp;
              <span className={styles.kbd}>?</span> all shortcuts
            </span>
          </div>
        </div>

        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 1C15.3544 1 18 3.64563 18 7V8C19.099 8 20 8.90104 20 10V20C20 21.099 19.099 22 18 22H6C4.90104 22 4 21.099 4 20V10C4 8.90104 4.90104 8 6 8V7C6 3.64563 8.64563 1 12 1ZM12 13C10.901 13 10 13.901 10 15C10 16.099 10.901 17 12 17C13.099 17 14 16.099 14 15C14 13.901 13.099 13 12 13ZM12 3C9.7502 3 8 4.7502 8 7V8H16V7C16 4.7502 14.2498 3 12 3Z" fill="currentColor" fillOpacity="0.7"/>
            </svg>
          </div>
          <div className={styles.featureText}>
            <span className={styles.featureLabel}>Private & Offline</span>
            <span className={styles.featureDesc}>
              All data is stored locally in your browser. Nothing is sent to a server.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Mention demo                                             */
/* ------------------------------------------------------------------ */

interface ProjectOption {
  id: number
  name: string
}

interface StepMentionDemoProps {
  editorRef: RefObject<HTMLDivElement | null>
}

function StepMentionDemo({ editorRef }: StepMentionDemoProps) {
  const { allPages } = useAutocomplete()
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [inserted, setInserted] = useState(false)

  // Get real project pages from the database
  const projectHub = useMemo(() => allPages.find((p) => p.role === 'project-hub'), [allPages])
  const projectOptions = useMemo<ProjectOption[]>(() => {
    if (!projectHub?.id) return []
    return allPages
      .filter((p) => p.parentId === projectHub.id && !p.archived)
      .map((p) => ({ id: p.id!, name: p.name }))
  }, [allPages, projectHub])

  const filteredOptions = mentionQuery !== null
    ? projectOptions.filter((p) => p.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : []

  const detectMention = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) { setMentionQuery(null); return }

    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) { setMentionQuery(null); return }

    const text = node.textContent ?? ''
    const offset = range.startOffset

    // Walk backwards to find #
    let i = offset - 1
    while (i >= 0) {
      if (text[i] === '#') {
        // Must be at start or preceded by whitespace
        if (i > 0 && !/\s/.test(text[i - 1])) { setMentionQuery(null); return }
        const query = text.slice(i + 1, offset)
        setMentionQuery(query)
        setActiveIdx(0)

        // Position dropdown relative to editor
        const editorEl = editorRef.current
        if (editorEl) {
          const tempRange = document.createRange()
          tempRange.setStart(node, i)
          tempRange.setEnd(node, i)
          const rect = tempRange.getBoundingClientRect()
          const editorRect = editorEl.getBoundingClientRect()
          setDropdownPos({
            top: rect.bottom - editorRect.top + 4,
            left: rect.left - editorRect.left,
          })
        }
        return
      }
      if (/\s/.test(text[i])) break
      i--
    }
    setMentionQuery(null)
  }, [editorRef])

  function insertMention(name: string, pageId: number) {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) return

    const text = node.textContent ?? ''
    const offset = range.startOffset

    // Find the # trigger
    let i = offset - 1
    while (i >= 0 && text[i] !== '#') i--
    if (i < 0) return

    // Split the text node: [before trigger] [mention span] [after cursor]
    const before = text.slice(0, i)
    const after = text.slice(offset)

    const span = document.createElement('span')
    span.setAttribute('data-mention', 'true')
    span.setAttribute('data-page-id', String(pageId))
    span.setAttribute('contenteditable', 'false')
    span.textContent = `#${name}`

    const parent = node.parentNode
    if (!parent) return

    // Replace text node with before + span + trailing space + after
    const beforeNode = document.createTextNode(before)
    const afterNode = document.createTextNode(`\u00A0${after}`)
    parent.replaceChild(afterNode, node)
    parent.insertBefore(span, afterNode)
    parent.insertBefore(beforeNode, span)

    // Move cursor after the space
    const newRange = document.createRange()
    newRange.setStart(afterNode, 1)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)

    setMentionQuery(null)
    setInserted(true)
  }

  function handleInput() {
    const el = editorRef.current
    if (!el) return

    // Check if content is empty and update data-empty attribute
    const isEmpty = !el.textContent?.trim() && !el.querySelector('[data-mention]')
    if (isEmpty) {
      el.setAttribute('data-empty', '')
    } else {
      el.removeAttribute('data-empty')
    }

    detectMention()
  }

  function handleKeyDown(e: ReactKeyboardEvent) {
    if (mentionQuery === null || filteredOptions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % filteredOptions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + filteredOptions.length) % filteredOptions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const opt = filteredOptions[activeIdx]
      insertMention(opt.name, opt.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMentionQuery(null)
    }
  }

  // Focus editor on mount
  useEffect(() => {
    editorRef.current?.focus()
  }, [editorRef])

  return (
    <div className={styles.stepContent}>
      <p className={styles.description}>
        Type <span className={styles.kbd}>#</span> in the timeline editor to reference a project.
        Mentions create cross-references — entries appear on the referenced page's timeline too.
      </p>

      <div>
        <span className={styles.editorLabel}>Try it out</span>
        <div className={styles.editorWrap}>
          <div
            ref={editorRef}
            className={styles.editor}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Type # to reference a project..."
            data-empty=""
            onInput={handleInput}
            onKeyDown={handleKeyDown}
          />

          {mentionQuery !== null && filteredOptions.length > 0 && dropdownPos && (
            <div
              className={styles.mentionDropdown}
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
            >
              {filteredOptions.map((opt, idx) => (
                <div
                  key={opt.id}
                  className={idx === activeIdx ? styles.mentionItemActive : styles.mentionItem}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(opt.name, opt.id) }}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <span className={styles.mentionPrefix}>#</span>
                  {opt.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <span className={styles.editorHint}>
          {inserted
            ? 'This entry will be saved to your Timeline when you click Get Started.'
            : 'Use arrow keys and Enter to select, or click an option.'}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main modal                                                        */
/* ------------------------------------------------------------------ */

const STEP_TITLES = ['Welcome to Timeline', 'Reference with #']
const TOTAL_STEPS = STEP_TITLES.length

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)
  const timelinePage = usePageByRole('main-timeline')
  const { addEntry } = useTimelineActions()
  const navigate = useNavigate()

  // Reset step when opened
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStep(0)
    }
    prevOpen.current = open
  }, [open])

  function handleClose() {
    localStorage.setItem('onboarding-completed', 'true')
    onClose()
  }

  async function handleNext() {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
    } else {
      // Persist editor content as a timeline entry on the main timeline
      const el = editorRef.current
      const hasMention = !!el?.querySelector('[data-mention]')
      if (el && timelinePage?.id) {
        const html = el.innerHTML
        const hasContent = !!el.textContent?.trim() || hasMention
        if (hasContent) {
          await addEntry({ pageId: timelinePage.id, text: html, isPending: false })
        }
      }
      handleClose()

      // Navigate to the main timeline page
      if (timelinePage?.id) {
        navigate(`/page/${timelinePage.id}`)
      }

      // Trigger highlight animation on mention spans if a mention was inserted
      if (hasMention) {
        document.documentElement.setAttribute('data-onboarding-highlight', '')
        setTimeout(() => {
          document.documentElement.removeAttribute('data-onboarding-highlight')
        }, 4000)
      }
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1)
  }

  return (
    <Modal title={STEP_TITLES[step]} open={open} onClose={handleClose} hideFooter>
      {step === 0 && <StepWelcome />}
      {step === 1 && <StepMentionDemo editorRef={editorRef} />}

      <div className={styles.stepNav}>
        <div className={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className={i === step ? styles.dotActive : styles.dot} />
          ))}
        </div>

        <div className={styles.navButtons}>
          {step > 0 && (
            <button className={styles.navButton} onClick={handleBack}>
              Back
            </button>
          )}
          <button className={styles.navButtonPrimary} onClick={handleNext}>
            {step < TOTAL_STEPS - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
