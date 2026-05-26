import { useEffect } from 'react'
import { useMentionInsertContext } from '../../hooks/useAppContext'
import { getMentionTriggerInfo } from './useMentionDetection'
import type { Page } from '../../types'

export function usePendingMentionInsert(
  editorRef: React.RefObject<HTMLDivElement | null>,
  allPages: Page[],
  collapseMentions: boolean | undefined,
  onChange: (html: string) => void,
) {
  const { pendingMentionInsert, setPendingMentionInsert } = useMentionInsertContext()

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
    const { trigger, collapsed } = getMentionTriggerInfo(pageId, allPages)
    if (trigger) {
      span.setAttribute('data-trigger', trigger)
      span.setAttribute('title', name)
      if (collapseMentions && collapsed) {
        span.setAttribute('data-collapsed', 'true')
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
    // Update lastSetValue via onChange (the parent component tracks this)
    onChange(html)
    setPendingMentionInsert(null)
  }, [pendingMentionInsert, setPendingMentionInsert, allPages, collapseMentions, onChange, editorRef])
}
