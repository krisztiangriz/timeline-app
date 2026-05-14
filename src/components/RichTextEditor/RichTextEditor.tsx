import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  useMemo,
  type KeyboardEvent,
} from 'react'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { useModalContext } from '../../hooks/useAppContext'
import { enrichMentionHtml } from '../../utils/mentionEnricher'
import { formatTableDate } from '../../utils/dateUtils'
import { CloseIcon } from '../Icons/Icons'
import styles from './RichTextEditor.module.css'

type AutocompleteOption =
  | { kind: 'mention'; id: number; name: string; prefix: string }
  | { kind: 'component'; id: string; label: string; componentType: 'timeline' | 'feedback' | 'table' | 'visualization' }

const COMPONENT_OPTIONS: AutocompleteOption[] = [
  { kind: 'component', id: 'timeline', label: 'Timeline', componentType: 'timeline' },
  { kind: 'component', id: 'feedback', label: 'Feedback', componentType: 'feedback' },
  { kind: 'component', id: 'table', label: 'Table', componentType: 'table' },
  { kind: 'component', id: 'visualization', label: 'Visualization', componentType: 'visualization' },
]

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
  /** Called when user selects a component from the ~ picker */
  onInsertComponent?: (type: 'timeline' | 'feedback' | 'table' | 'visualization') => void
  /** When true, new lines automatically get a checkbox prepended */
  autoCheckbox?: boolean
  /** Called when a checkbox is toggled to checked. Receives the text content of that line (HTML stripped of the checkbox span) and the remaining editor HTML after removal. */
  onCheckboxComplete?: (lineHtml: string, remainingHtml: string) => void
  /** Debounced auto-save callback — fires 500ms after last input. Only persists data, no UI state changes. */
  onAutoSave?: (html: string) => void
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
  onInsertComponent,
  autoCheckbox,
  onCheckboxComplete,
  onAutoSave,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isFocusedRef = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPos, setLinkPos] = useState({ top: 0, left: 0 })

  // ---- Mention state ----
  const [mentionQuery, setMentionQuery] = useState<{ prefix: string; text: string } | null>(null)
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 })
  const [mentionIndex, setMentionIndex] = useState(0)
  const mentionRange = useRef<{ node: Text; start: number } | null>(null)

  // Load pages for autocomplete (shared context — single subscription for all editors)
  const { allPages } = useAutocomplete()
  const { setAddPageOpen, setAddPageInitial, pendingMentionInsert, setPendingMentionInsert } = useModalContext()

  // Build set of active hub trigger characters
  const hubTriggers = useMemo<Set<string>>(() =>
    new Set(allPages.filter((p) => p.mentionTrigger).map((p) => p.mentionTrigger!)),
    [allPages]
  )

  const autocompleteOptions = useMemo<AutocompleteOption[]>(() => {
    if (!mentionQuery) return []
    const q = mentionQuery.text.toLowerCase()

    if (mentionQuery.prefix === '~') {
      return COMPONENT_OPTIONS.filter((c) => {
        if (c.kind !== 'component') return false
        return c.label.toLowerCase().includes(q)
      })
    }

    // Trigger — find the page that owns this trigger
    const triggerPage = allPages.find((p) => p.mentionTrigger === mentionQuery.prefix && !p.archived)
    if (!triggerPage?.id) return []

    if (triggerPage.type === 'hub') {
      // Hub trigger: list children (exclude archived)
      return allPages
        .filter((p) => p.parentId === triggerPage.id && !p.archived && p.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((p) => ({
          kind: 'mention' as const,
          id: p.id!,
          name: p.name,
          prefix: mentionQuery.prefix,
        }))
    } else {
      // Page-level trigger: show the page itself as the single option
      if (triggerPage.name.toLowerCase().includes(q)) {
        return [{ kind: 'mention' as const, id: triggerPage.id!, name: triggerPage.name, prefix: mentionQuery.prefix }]
      }
      return []
    }
  }, [mentionQuery, allPages])

  // Sync external value → editor (useLayoutEffect prevents visible flash)
  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (el.innerHTML !== value) {
      el.innerHTML = enrichMentionHtml(value, allPages, collapseMentions)
    }
    const text = el.textContent?.trim() ?? ''
    const hasElements = el.querySelector('[data-checkbox], [data-mention]') !== null
    if (text === '' && !hasElements && !isFocusedRef.current) {
      el.setAttribute('data-empty', 'true')
    } else if (text !== '' || hasElements) {
      el.removeAttribute('data-empty')
    }
  }, [value, collapseMentions])

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

  // Cleanup auto-save timer on unmount
  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
  }, [])

  // Consume pendingMentionInsert: find trigger text in editor and replace with mention span
  useEffect(() => {
    if (!pendingMentionInsert) return
    const el = editorRef.current
    if (!el) return

    const { pageId, name, triggerText } = pendingMentionInsert

    // Walk all text nodes to find the trigger text (search from end for most recent occurrence)
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let foundNode: Text | null = null
    let foundOffset = -1

    const nodes: Text[] = []
    let current: Node | null
    while ((current = walker.nextNode())) {
      nodes.push(current as Text)
    }

    // Search from end (last occurrence is most likely the one the user just typed)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const textNode = nodes[i]
      const idx = (textNode.textContent || '').lastIndexOf(triggerText)
      if (idx !== -1) {
        foundNode = textNode
        foundOffset = idx
        break
      }
    }

    if (!foundNode || foundOffset === -1) {
      setPendingMentionInsert(null)
      return
    }

    // Replace the trigger text with a mention span
    const text = foundNode.textContent || ''
    const before = text.substring(0, foundOffset)
    const after = text.substring(foundOffset + triggerText.length)

    const span = document.createElement('span')
    span.setAttribute('data-mention', 'true')
    span.setAttribute('data-page-id', String(pageId))
    span.contentEditable = 'false'
    span.appendChild(document.createTextNode(name))

    // Set trigger attribute for collapse behavior
    const mentionPage = allPages.find((p) => p.id === pageId)
    const parentHub = mentionPage?.parentId ? allPages.find((p) => p.id === mentionPage.parentId) : undefined
    const trigger = parentHub?.mentionTrigger ?? allPages.find((p) => p.id === pageId && p.mentionTrigger)?.mentionTrigger
    if (trigger) {
      span.setAttribute('data-trigger', trigger)
      span.setAttribute('title', name)
      if (collapseMentions) {
        const hub = parentHub ?? allPages.find((p) => p.id === pageId && p.mentionTrigger)
        if (hub?.mentionCollapsed) {
          span.setAttribute('data-collapsed', 'true')
        }
      }
    }

    const parent = foundNode.parentNode
    if (!parent) {
      setPendingMentionInsert(null)
      return
    }

    const beforeNode = document.createTextNode(before)
    const trailing = after ? ` ${after}` : '\u00A0'
    const afterNode = document.createTextNode(trailing)

    parent.replaceChild(afterNode, foundNode)
    parent.insertBefore(span, afterNode)
    parent.insertBefore(beforeNode, span)

    // Focus the editor (it lost focus while the modal was open) and move cursor after the mention
    el.focus()
    const sel = window.getSelection()
    if (sel) {
      const range = document.createRange()
      range.setStart(afterNode, 1)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }

    // Emit change and clear pending state
    const html = el.innerHTML
    onChange(html)
    setPendingMentionInsert(null)
  }, [pendingMentionInsert, setPendingMentionInsert, allPages, collapseMentions, onChange])

  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const html = el.innerHTML
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

  // ---- Focus / blur: hide placeholder on focus, restore on blur if empty ----

  function handleFocus() {
    const el = editorRef.current
    if (!el) return
    isFocusedRef.current = true
    el.removeAttribute('data-empty')
    onFocus?.()

    // Position cursor at the beginning
    const sel = window.getSelection()
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
    setTimeout(() => {
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
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
    const el = editorRef.current
    if (el) {
      const marker = el.querySelector('[data-link-pending]')
      if (marker) {
        const link = document.createElement('a')
        link.href = url
        link.target = '_blank'
        link.rel = 'noopener'
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

  // ---- Mention detection ----

  function detectMention() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      setMentionQuery(null)
      return
    }

    const node = sel.anchorNode
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      setMentionQuery(null)
      return
    }

    const text = node.textContent || ''
    const offset = sel.anchorOffset

    // Walk backwards from cursor to find a trigger character
    let triggerIdx = -1
    let prefix: string | null = null
    for (let i = offset - 1; i >= 0; i--) {
      const ch = text[i]
      if (ch === '!' || ch === '~' || hubTriggers.has(ch)) {
        if (i === 0 || /\s/.test(text[i - 1])) {
          triggerIdx = i
          prefix = ch
        }
        break
      }
      if (/\s/.test(ch)) break
    }

    if (triggerIdx === -1 || !prefix) {
      setMentionQuery(null)
      return
    }

    const query = text.substring(triggerIdx + 1, offset)
    mentionRange.current = { node: node as Text, start: triggerIdx }

    // Position dropdown
    const range = document.createRange()
    range.setStart(node, triggerIdx)
    range.setEnd(node, offset)
    const rect = range.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setMentionPos({ top: rect.bottom - editorRect.top + 4, left: rect.left - editorRect.left })
    }

    setMentionQuery({ prefix, text: query })
    setMentionIndex(0)
  }

  function insertAutocomplete(option: AutocompleteOption) {
    if (!mentionRange.current) return
    const { node, start } = mentionRange.current
    const sel = window.getSelection()
    if (!sel) return

    const offset = sel.anchorOffset
    const text = node.textContent || ''
    const before = text.substring(0, start)
    const after = text.substring(offset)

    // Component insertion — remove ~text, call onInsertComponent, close
    if (option.kind === 'component') {
      node.textContent = before + after
      setMentionQuery(null)
      mentionRange.current = null
      emitChange()
      onInsertComponent?.(option.componentType)
      return
    }

    const span = document.createElement('span')
    span.setAttribute('data-mention', 'true')
    span.setAttribute('data-page-id', String(option.id))
    span.contentEditable = 'false'
    span.appendChild(document.createTextNode(option.name))
    // Store trigger character for CSS-based collapse
    const mentionPage = allPages.find((p) => p.id === option.id)
    const parentHub = mentionPage?.parentId ? allPages.find((p) => p.id === mentionPage.parentId) : undefined
    const trigger = parentHub?.mentionTrigger ?? allPages.find((p) => p.id === option.id && p.mentionTrigger)?.mentionTrigger
    if (trigger) {
      span.setAttribute('data-trigger', trigger)
      span.setAttribute('title', option.name)
      if (collapseMentions) {
        const hub = parentHub ?? allPages.find((p) => p.id === option.id && p.mentionTrigger)
        if (hub?.mentionCollapsed) {
          span.setAttribute('data-collapsed', 'true')
        }
      }
    }

    const parent = node.parentNode
    if (!parent) return

    const beforeNode = document.createTextNode(before)
    const trailing = after ? ` ${after}` : '\u00A0'
    const afterNode = document.createTextNode(trailing)

    parent.replaceChild(afterNode, node)
    parent.insertBefore(span, afterNode)
    parent.insertBefore(beforeNode, span)

    // Move cursor after inserted span
    const range = document.createRange()
    range.setStart(afterNode, 0)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)

    setMentionQuery(null)
    mentionRange.current = null
    emitChange()
  }

  function handleAddPageFromDropdown() {
    if (!mentionQuery) return
    const prefix = mentionQuery.prefix
    const queryText = mentionQuery.text
    const triggerText = prefix + queryText

    // Find the hub that owns this trigger
    const triggerPage = allPages.find((p) => p.mentionTrigger === prefix && !p.archived)
    const parentHubId = triggerPage?.type === 'hub' ? triggerPage.id : undefined

    setAddPageInitial({
      name: queryText,
      parentHubId,
      triggerPrefix: prefix,
      triggerText,
    })
    setAddPageOpen(true)
    setMentionQuery(null)
    mentionRange.current = null
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
    if (mentionQuery && autocompleteOptions.length === 0 && mentionQuery.prefix !== '~') {
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

    // Atomic deletion of non-editable spans (mentions) + checkbox line removal
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection()
      if (sel && sel.isCollapsed && sel.rangeCount > 0) {
        const node = sel.anchorNode
        const offset = sel.anchorOffset

        if (e.key === 'Backspace') {
          // Backspace at start of a checkbox line: remove checkbox and merge up
          if (autoCheckbox && node?.nodeType === Node.TEXT_NODE && offset === 0) {
            const prevSib = node.previousSibling as HTMLElement | null
            if (prevSib?.nodeType === Node.ELEMENT_NODE && prevSib.hasAttribute('data-checkbox')) {
              e.preventDefault()
              const parentDiv = node.parentNode as HTMLElement | null
              if (parentDiv && parentDiv !== editorRef.current && parentDiv.parentNode === editorRef.current) {
                const prevBlock = parentDiv.previousSibling as HTMLElement | null
                // Remove the checkbox span
                prevSib.remove()
                if (prevBlock) {
                  // Merge remaining content into previous block
                  const content = parentDiv.innerHTML
                  const cleanContent = content.replace(/^\s*&nbsp;\s*$/, '').replace(/^\u00A0$/, '')
                  if (cleanContent) {
                    prevBlock.innerHTML += cleanContent
                  }
                  parentDiv.remove()
                  // Place cursor at end of previous block
                  const range = document.createRange()
                  range.selectNodeContents(prevBlock)
                  range.collapse(false)
                  sel.removeAllRanges()
                  sel.addRange(range)
                } else {
                  // First line — just remove the checkbox, keep content
                  if (!parentDiv.textContent?.trim()) {
                    parentDiv.remove()
                  }
                }
              } else {
                // Simple case: just remove checkbox
                prevSib.remove()
              }
              emitChange()
              return
            }
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
      window.open(link.href, '_blank', 'noopener')
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
    if (target.hasAttribute('data-checkbox')) {
      const current = target.getAttribute('data-checkbox')
      if (current === 'false' && onCheckboxComplete) {
        // Find the line container (a div child of the editor, or the editor itself for top-level content)
        const el = editorRef.current
        let container = target.parentElement
        // Walk up to find the direct child of the editor that contains this checkbox
        while (container && container !== el && container.parentElement !== el) {
          container = container.parentElement
        }
        if (container && container !== el) {
          // Clone the container, remove the checkbox span, get remaining HTML
          const clone = container.cloneNode(true) as HTMLElement
          const checkboxClone = clone.querySelector('[data-checkbox]')
          if (checkboxClone) checkboxClone.remove()
          const lineHtml = clone.innerHTML.replace(/\u00A0/g, ' ').trim()
          // Remove this line from the editor
          container.remove()
          emitChange()
          onCheckboxComplete(lineHtml, el?.innerHTML ?? '')
        } else if (el) {
          // Checkbox is at the top level of the editor (no wrapper div)
          // Get siblings of the checkbox until the next block break
          const clone = el.cloneNode(true) as HTMLElement
          const checkboxClone = clone.querySelector('[data-checkbox]')
          if (checkboxClone) {
            // Collect text content after checkbox until <br> or <div>
            let lineContent = ''
            let next = checkboxClone.nextSibling
            const toRemove: Node[] = [checkboxClone]
            while (next && next.nodeName !== 'DIV' && next.nodeName !== 'BR') {
              if (next.nodeType === Node.TEXT_NODE) lineContent += next.textContent
              else lineContent += (next as HTMLElement).outerHTML
              toRemove.push(next)
              next = next.nextSibling
            }
            // Remove the checkbox and its line content from the actual editor
            let actualNext: Node | null = target.nextSibling
            const actualToRemove: Node[] = [target]
            while (actualNext && actualNext.nodeName !== 'DIV' && actualNext.nodeName !== 'BR') {
              actualToRemove.push(actualNext)
              actualNext = actualNext.nextSibling
            }
            // Also remove the trailing <br> if present
            if (actualNext && actualNext.nodeName === 'BR') actualToRemove.push(actualNext)
            for (const node of actualToRemove) node.parentNode?.removeChild(node)
            emitChange()
            onCheckboxComplete(lineContent.replace(/\u00A0/g, ' ').trim(), el.innerHTML)
          }
        }
        return
      }
      target.setAttribute('data-checkbox', current === 'true' ? 'false' : 'true')
      emitChange()
    }
  }

  function handleInput() {
    const el = editorRef.current
    if (!el) return

    // Check for [] pattern — insert checkbox at the beginning of the line
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const node = sel.anchorNode
      if (node && node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''
        const offset = sel.anchorOffset
        if (offset >= 2 && text.substring(offset - 2, offset) === '[]') {
          const before = text.substring(0, offset - 2)
          const after = text.substring(offset)
          const remaining = (before + after).trimStart() || '\u00A0'
          const checkbox = document.createElement('span')
          checkbox.setAttribute('data-checkbox', 'false')
          checkbox.textContent = ''
          const parent = node.parentNode
          if (parent) {
            const textNode = document.createTextNode(remaining)
            parent.replaceChild(textNode, node)
            parent.insertBefore(checkbox, textNode)
            const range = document.createRange()
            range.setStartAfter(checkbox)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        }
      }
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
            >
              {opt.kind === 'component' ? (
                <>
                  <span className={styles.mentionPrefix}>~</span>
                  {opt.label}
                </>
              ) : (
                <>
                  <span className={styles.mentionPrefix}>{opt.prefix}</span>
                  {opt.name}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* "Add page" option when no matches for a trigger lookup */}
      {mentionQuery && autocompleteOptions.length === 0 && mentionQuery.prefix !== '~' && (
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
