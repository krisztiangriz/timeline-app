import { useState, useMemo, useRef, useCallback } from 'react'
import type { Page } from '../../types'
import type { AddPageInitial } from '../../hooks/useAppContext'

export type AutocompleteOption =
  | { kind: 'mention'; id: number; name: string; prefix: string }

/** Get the mention trigger and collapse info for a page (via its parent hub) */
export function getMentionTriggerInfo(pageId: number, allPages: Page[]) {
  const page = allPages.find((p) => p.id === pageId)
  const parentHub = page?.parentId ? allPages.find((p) => p.id === page.parentId) : undefined
  const trigger = parentHub?.mentionTrigger ?? allPages.find((p) => p.id === pageId && p.mentionTrigger)?.mentionTrigger
  const collapsed = parentHub?.mentionCollapsed ?? allPages.find((p) => p.id === pageId && p.mentionTrigger)?.mentionCollapsed
  return { trigger, collapsed: !!collapsed }
}

export function useMentionDetection(
  editorRef: React.RefObject<HTMLDivElement | null>,
  allPages: Page[],
  collapseMentions: boolean | undefined,
  emitChange: () => void,
  setAddPageOpen: (v: boolean) => void,
  setAddPageInitial: (v: AddPageInitial | undefined) => void,
) {
  const [mentionQuery, setMentionQuery] = useState<{ prefix: string; text: string } | null>(null)
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 })
  const [mentionIndex, setMentionIndex] = useState(0)
  const mentionRange = useRef<{ node: Text; start: number } | null>(null)

  // Build set of active hub trigger characters
  const hubTriggers = useMemo<Set<string>>(() =>
    new Set(allPages.filter((p) => p.mentionTrigger).map((p) => p.mentionTrigger!)),
    [allPages]
  )

  const autocompleteOptions = useMemo<AutocompleteOption[]>(() => {
    if (!mentionQuery) return []
    const q = mentionQuery.text.toLowerCase()

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

  const detectMention = useCallback(() => {
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
      if (hubTriggers.has(ch)) {
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
  }, [hubTriggers, editorRef])

  const insertAutocomplete = useCallback((option: AutocompleteOption) => {
    if (!mentionRange.current) return
    const { node, start } = mentionRange.current
    const sel = window.getSelection()
    if (!sel) return

    const offset = sel.anchorOffset
    const text = node.textContent || ''
    const before = text.substring(0, start)
    const after = text.substring(offset)

    const span = document.createElement('span')
    span.setAttribute('data-mention', 'true')
    span.setAttribute('data-page-id', String(option.id))
    span.contentEditable = 'false'
    span.appendChild(document.createTextNode(option.name))
    // Store trigger character for CSS-based collapse
    const { trigger, collapsed } = getMentionTriggerInfo(option.id, allPages)
    if (trigger) {
      span.setAttribute('data-trigger', trigger)
      span.setAttribute('title', option.name)
      if (collapseMentions && collapsed) {
        span.setAttribute('data-collapsed', 'true')
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
  }, [allPages, collapseMentions, emitChange])

  const handleAddPageFromDropdown = useCallback(() => {
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
  }, [mentionQuery, allPages, setAddPageInitial, setAddPageOpen])

  return {
    mentionQuery,
    setMentionQuery,
    mentionPos,
    mentionIndex,
    setMentionIndex,
    mentionRange,
    hubTriggers,
    autocompleteOptions,
    detectMention,
    insertAutocomplete,
    handleAddPageFromDropdown,
  }
}
