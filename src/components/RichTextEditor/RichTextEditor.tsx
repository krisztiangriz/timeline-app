import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  type KeyboardEvent,
} from 'react'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useModalContext } from '../../hooks/useAppContext'
import { enrichMentionHtml } from '../../utils/mentionEnricher'
import { sanitizeForEditor } from '../../utils/domPurify'
import { formatTableDate } from '../../utils/dateUtils'
import { CloseIcon } from '../Icons/Icons'
import { useMentionDetection } from './useMentionDetection'
import { usePendingMentionInsert } from './usePendingMentionInsert'
import { useCheckboxHandling } from './useCheckboxHandling'
import styles from './RichTextEditor.module.css'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  onBlur?: () => void
  onFocus?: () => void
  autoFocus?: boolean
  /** Place cursor at this screen coordinate on initial focus (click-to-edit) */
  initialClickPosition?: { x: number; y: number }
  /** When true, mentions with collapsed hubs show only the trigger character */
  collapseMentions?: boolean
  className?: string
  onEnter?: () => void
  /** Called when user clicks a mention span with a page ID */
  onMentionClick?: (pageId: number) => void
  /** When true, new lines automatically get a checkbox prepended */
  autoCheckbox?: boolean
  /** Called when a checkbox is toggled to checked. Receives the text content of that line (HTML stripped of the checkbox span) and the remaining editor HTML after removal. */
  onCheckboxComplete?: (lineHtml: string, remainingHtml: string) => void
  /** Debounced auto-save callback — fires 500ms after last input. Only persists data, no UI state changes. */
  onAutoSave?: (html: string) => void
  /** Called when Escape is pressed (and mention dropdown is not open). Used for exiting edit mode. */
  onEscape?: () => void
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = '',
  onBlur,
  onFocus,
  autoFocus,
  initialClickPosition,
  collapseMentions,
  className,
  onEnter,
  onMentionClick,
  autoCheckbox,
  onCheckboxComplete,
  onAutoSave,
  onEscape,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isFocusedRef = useRef(false)
  const lastSetValue = useRef('')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPos, setLinkPos] = useState({ top: 0, left: 0 })

  // Load pages for autocomplete (shared context — single subscription for all editors)
  const { allPages } = useAutocomplete()
  const { setAddPageOpen, setAddPageInitial } = useModalContext()

  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const html = el.innerHTML
    lastSetValue.current = html
    onChange(html)
    // Toggle empty state — but never show placeholder while focused
    const text = el.textContent?.trim() ?? ''
    const hasElements = el.querySelector('[data-checkbox], [data-mention]') !== null
    if (text !== '' || hasElements) {
      el.removeAttribute('data-empty')
    } else if (!isFocusedRef.current) {
      el.setAttribute('data-empty', 'true')
    }
    // Debounced auto-save
    if (onAutoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => onAutoSave(html), 500)
    }
  }, [onChange, onAutoSave])

  // ---- Extracted hooks ----

  const {
    mentionQuery,
    setMentionQuery,
    mentionPos,
    mentionIndex,
    setMentionIndex,
    autocompleteOptions,
    detectMention,
    insertAutocomplete,
    handleAddPageFromDropdown,
  } = useMentionDetection(
    editorRef,
    allPages,
    collapseMentions,
    emitChange,
    setAddPageOpen,
    setAddPageInitial,
  )

  // Handle pending mention insert from AddPage modal
  const onChangeForPending = useCallback((html: string) => {
    lastSetValue.current = html
    onChange(html)
  }, [onChange])

  usePendingMentionInsert(editorRef, allPages, collapseMentions, onChangeForPending)

  const {
    handleCheckboxClick,
    handleCheckboxBackspace,
    detectCheckboxPattern,
  } = useCheckboxHandling(editorRef, autoCheckbox, onCheckboxComplete, emitChange)

  // Sync external value → editor (useLayoutEffect prevents visible flash)
  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (value !== lastSetValue.current) {
      el.innerHTML = enrichMentionHtml(sanitizeForEditor(value), allPages, collapseMentions)
      lastSetValue.current = value
    }
    const text = el.textContent?.trim() ?? ''
    const hasElements = el.querySelector('[data-checkbox], [data-mention]') !== null
    if (text === '' && !hasElements && !isFocusedRef.current) {
      el.setAttribute('data-empty', 'true')
    } else if (text !== '' || hasElements) {
      el.removeAttribute('data-empty')
    }
  }, [value, collapseMentions, allPages])

  // Use <br> for line breaks instead of wrapping in <div>
  useEffect(() => {
    document.execCommand('defaultParagraphSeparator', false, 'br')
  }, [])

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus()
      const sel = window.getSelection()
      if (sel) {
        let range: Range | null = null
        // Place cursor at the click position if provided
        if (initialClickPosition) {
          range = document.caretRangeFromPoint(initialClickPosition.x, initialClickPosition.y)
          // Firefox fallback: caretPositionFromPoint
          if (!range && 'caretPositionFromPoint' in document) {
            const pos = (document as unknown as { caretPositionFromPoint(x: number, y: number): { offsetNode: Node; offset: number } | null }).caretPositionFromPoint(initialClickPosition.x, initialClickPosition.y)
            if (pos) {
              range = document.createRange()
              range.setStart(pos.offsetNode, pos.offset)
              range.collapse(true)
            }
          }
        }
        // Fallback: place cursor at end of content
        if (!range) {
          range = document.createRange()
          range.selectNodeContents(editorRef.current)
          range.collapse(false)
        }
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [autoFocus, initialClickPosition])

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (blurTimer.current) clearTimeout(blurTimer.current)
  }, [])

  // ---- Focus / blur: hide placeholder on focus, restore on blur if empty ----

  function handleFocus() {
    const el = editorRef.current
    if (!el) return
    isFocusedRef.current = true
    el.removeAttribute('data-empty')
    onFocus?.()

    // Position cursor at the beginning only on programmatic/keyboard focus.
    // If the browser already placed the cursor inside the editor (via mouse click), don't override.
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (el.contains(range.startContainer)) return // cursor already inside — mouse click
    }
    if (sel) {
      const range = document.createRange()
      range.setStart(el, 0)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  function handleBlur() {
    isFocusedRef.current = false
    // Flush any pending auto-save immediately
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = null
      onAutoSave?.(editorRef.current?.innerHTML ?? '')
    }
    blurTimer.current = setTimeout(() => {
      if (!showLinkInput && !mentionQuery) {
        // Re-show placeholder if empty and still not focused
        const el = editorRef.current
        if (el && !isFocusedRef.current) {
          const text = el.textContent?.replace(/\u00A0/g, '').trim() ?? ''
          const hasCheckbox = el.querySelector('[data-checkbox]') !== null
          const hasMention = el.querySelector('[data-mention]') !== null
          // If autoCheckbox, treat checkbox-only content (no real text) as empty
          const effectivelyEmpty = autoCheckbox
            ? text === '' && !hasMention
            : text === '' && !hasCheckbox && !hasMention
          if (effectivelyEmpty) {
            el.innerHTML = ''
            el.setAttribute('data-empty', 'true')
            emitChange()
          }
        }
        onBlur?.()
      }
    }, 150)
  }

  // ---- execCommand helpers ----

  function exec(command: string, val?: string) {
    document.execCommand(command, false, val)
    editorRef.current?.focus()
    emitChange()
  }

  function toggleBlock(tag: string) {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const block = getContainingBlock(sel.anchorNode)
    if (block && block.nodeName.toLowerCase() === tag.toLowerCase()) {
      exec('formatBlock', 'div')
    } else {
      exec('formatBlock', tag)
    }
  }

  function insertBulletList() {
    // Remove dash style if currently a dash list, then toggle bullet list
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const ul = sel.anchorNode?.parentElement?.closest('ul')
      if (ul) ul.removeAttribute('data-list-style')
    }
    exec('insertUnorderedList')
  }

  function insertDashList() {
    // Create an unordered list, then mark it as dashed
    exec('insertUnorderedList')
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const ul = sel.anchorNode?.parentElement?.closest('ul')
      if (ul) ul.setAttribute('data-list-style', 'dash')
    }
    emitChange()
  }

  function openLinkInput() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return

    const range = sel.getRangeAt(0)
    const marker = document.createElement('span')
    marker.setAttribute('data-link-pending', 'true')
    const fragment = range.extractContents()
    marker.appendChild(fragment)
    range.insertNode(marker)
    emitChange()

    const rect = marker.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setLinkPos({ top: rect.bottom - editorRect.top + 4, left: rect.left - editorRect.left })
    }
    setLinkUrl('')
    setShowLinkInput(true)
  }

  function applyLink() {
    if (!linkUrl.trim()) { cancelLink(); return }
    const raw = linkUrl.startsWith('http') || linkUrl.startsWith('mailto:') ? linkUrl : `https://${linkUrl}`
    let url: string
    try {
      const parsed = new URL(raw)
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) { cancelLink(); return }
      url = parsed.href
    } catch { cancelLink(); return }
    const el = editorRef.current
    if (el) {
      const marker = el.querySelector('[data-link-pending]')
      if (marker) {
        const link = document.createElement('a')
        link.href = url
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.contentEditable = 'false'
        link.innerHTML = marker.innerHTML
        marker.replaceWith(link)
      }
    }
    emitChange()
    setShowLinkInput(false)
  }

  function cancelLink() {
    const el = editorRef.current
    if (el) {
      const marker = el.querySelector('[data-link-pending]')
      if (marker) {
        marker.replaceWith(...Array.from(marker.childNodes))
      }
    }
    emitChange()
    setShowLinkInput(false)
  }

  // ---- Keyboard handler ----

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // If mention dropdown is showing, handle arrow/enter/escape
    if (mentionQuery && autocompleteOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i < autocompleteOptions.length - 1 ? i + 1 : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i > 0 ? i - 1 : autocompleteOptions.length - 1))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertAutocomplete(autocompleteOptions[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }

    // "Add page" option showing (no results, non-~ trigger)
    if (mentionQuery && autocompleteOptions.length === 0) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleAddPageFromDropdown()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }

    // Escape exits editing when no mention dropdown is open
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault()
      onEscape()
      return
    }

    // Atomic deletion of non-editable spans (mentions) + checkbox line removal
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection()
      if (sel && sel.isCollapsed && sel.rangeCount > 0) {
        const node = sel.anchorNode
        const offset = sel.anchorOffset

        if (e.key === 'Backspace') {
          // Backspace at start of a checkbox line: remove checkbox and merge up
          if (node && handleCheckboxBackspace(sel, node, offset)) {
            e.preventDefault()
            return
          }

          // Check if previous sibling is a non-editable span
          if (node?.nodeType === Node.TEXT_NODE && offset === 0) {
            const prev = node.previousSibling as HTMLElement | null
            if (prev?.nodeType === Node.ELEMENT_NODE && prev.getAttribute('contenteditable') === 'false') {
              e.preventDefault()
              prev.remove()
              emitChange()
              return
            }
          }
          // Check if cursor is right after a non-editable element within parent
          if (node?.nodeType === Node.ELEMENT_NODE) {
            const child = (node as HTMLElement).childNodes[offset - 1] as HTMLElement | undefined
            if (child?.nodeType === Node.ELEMENT_NODE && child.getAttribute('contenteditable') === 'false') {
              e.preventDefault()
              child.remove()
              emitChange()
              return
            }
          }
        }

        if (e.key === 'Delete') {
          // Check if next sibling is a non-editable span
          if (node?.nodeType === Node.TEXT_NODE && offset === (node.textContent?.length ?? 0)) {
            const next = node.nextSibling as HTMLElement | null
            if (next?.nodeType === Node.ELEMENT_NODE && next.getAttribute('contenteditable') === 'false') {
              e.preventDefault()
              next.remove()
              emitChange()
              return
            }
          }
          if (node?.nodeType === Node.ELEMENT_NODE) {
            const child = (node as HTMLElement).childNodes[offset] as HTMLElement | undefined
            if (child?.nodeType === Node.ELEMENT_NODE && child.getAttribute('contenteditable') === 'false') {
              e.preventDefault()
              child.remove()
              emitChange()
              return
            }
          }
        }
      }
    }

    const meta = e.metaKey || e.ctrlKey
    const ctrl = e.ctrlKey

    // Ctrl+letter: text styles (conflict-free on macOS)
    if (ctrl && !e.metaKey) {
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); toggleBlock('h1'); return }
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); toggleBlock('h2'); return }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); toggleBlock('h3'); return }
      if (e.key === '0') { e.preventDefault(); toggleBlock('div'); return }
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleBlock('pre'); return }
      if (e.key === '7') { e.preventDefault(); insertBulletList(); return }
      if (e.key === '8') { e.preventDefault(); insertDashList(); return }
      if (e.key === '9') { e.preventDefault(); exec('insertOrderedList'); return }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); openLinkInput(); return }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); document.execCommand('insertText', false, formatTableDate(new Date())); emitChange(); return }
    }

    // Cmd+B/I/U: standard formatting (matches browser)
    if (meta && e.key === 'b') { e.preventDefault(); exec('bold'); return }
    if (meta && e.key === 'i') { e.preventDefault(); exec('italic'); return }
    if (meta && e.key === 'u') { e.preventDefault(); exec('underline'); return }

    if (e.key === 'Tab') {
      e.preventDefault()
      exec(e.shiftKey ? 'outdent' : 'indent')
      return
    }

    if (e.key === 'Enter' && !e.shiftKey && onEnter) {
      e.preventDefault()
      onEnter()
      return
    }

  }

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement

    // Open links in new tab
    const link = target.closest('a[href]') as HTMLAnchorElement | null
    if (link) {
      e.preventDefault()
      window.open(link.href, '_blank', 'noopener,noreferrer')
      return
    }

    // Navigate on mention click
    if (onMentionClick) {
      const mention = target.closest('[data-page-id]') as HTMLElement | null
      if (mention) {
        const pageId = Number(mention.getAttribute('data-page-id'))
        if (pageId) {
          e.preventDefault()
          onMentionClick(pageId)
          return
        }
      }
    }

    // Toggle checkbox
    if (handleCheckboxClick(target)) return
  }

  function handleInput() {
    const el = editorRef.current
    if (!el) return

    // Check for [] pattern — insert checkbox at the beginning of the line
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      detectCheckboxPattern(sel)
    }

    emitChange()
    detectMention()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }

  const editorClassName = [styles.editor, className].filter(Boolean).join(' ')

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={editorRef}
        className={editorClassName}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder || 'Rich text editor'}
        data-rich-editor="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
      />

      {/* Link URL input popover */}
      {showLinkInput && (
        <div className={styles.linkPopover} style={{ top: linkPos.top, left: linkPos.left }}>
          <input
            className={styles.linkInput}
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') { e.preventDefault(); cancelLink() }
            }}
            placeholder="Enter URL..."
            autoFocus
          />
          <button className={styles.linkConfirm} onClick={applyLink} aria-label="Confirm">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className={styles.linkConfirm} onClick={cancelLink} aria-label="Cancel">
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      {/* Mention autocomplete dropdown */}
      {mentionQuery && autocompleteOptions.length > 0 && (
        <div
          className={styles.mentionDropdown}
          style={{ top: mentionPos.top, left: mentionPos.left }}
          role="listbox"
        >
          {autocompleteOptions.map((opt, i) => (
            <div
              key={opt.id}
              className={i === mentionIndex ? styles.mentionItemActive : styles.mentionItem}
              onMouseDown={(e) => {
                e.preventDefault()
                insertAutocomplete(opt)
              }}
              onMouseEnter={() => setMentionIndex(i)}
              role="option"
            >
              <span className={styles.mentionPrefix}>{opt.prefix}</span>
              {opt.name}
            </div>
          ))}
        </div>
      )}

      {/* "Add page" option when no matches for a trigger lookup */}
      {mentionQuery && autocompleteOptions.length === 0 && (
        <div
          className={styles.mentionDropdown}
          style={{ top: mentionPos.top, left: mentionPos.left }}
        >
          <div
            className={styles.mentionItemActive}
            onMouseDown={(e) => {
              e.preventDefault()
              handleAddPageFromDropdown()
            }}
          >
            <span className={styles.mentionPrefix}>+</span>
            Add &ldquo;{mentionQuery.text || 'page'}&rdquo;
          </div>
        </div>
      )}
    </div>
  )
}

function getContainingBlock(node: Node | null): HTMLElement | null {
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const display = window.getComputedStyle(el).display
      if (display === 'block' || /^H[1-6]$/.test(el.nodeName) || el.nodeName === 'DIV' || el.nodeName === 'P') {
        return el
      }
    }
    node = node.parentNode
  }
  return null
}
