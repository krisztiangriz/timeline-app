import { useCallback } from 'react'

export function useCheckboxHandling(
  editorRef: React.RefObject<HTMLDivElement | null>,
  autoCheckbox: boolean | undefined,
  onCheckboxComplete: ((lineHtml: string, remainingHtml: string) => void) | undefined,
  emitChange: () => void,
) {
  /**
   * Handles checkbox click (toggle or completion).
   * Returns true if the click event was handled and should not propagate further.
   */
  const handleCheckboxClick = useCallback((target: HTMLElement): boolean => {
    if (!target.hasAttribute('data-checkbox')) return false

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
      return true
    }
    target.setAttribute('data-checkbox', current === 'true' ? 'false' : 'true')
    emitChange()
    return true
  }, [editorRef, onCheckboxComplete, emitChange])

  /**
   * Handles backspace at the start of a checkbox line (removes checkbox and merges up).
   * Returns true if the event was handled.
   */
  const handleCheckboxBackspace = useCallback((sel: Selection, node: Node, offset: number): boolean => {
    if (!autoCheckbox) return false
    if (node.nodeType !== Node.TEXT_NODE || offset !== 0) return false

    const prevSib = node.previousSibling as HTMLElement | null
    if (!prevSib || prevSib.nodeType !== Node.ELEMENT_NODE || !prevSib.hasAttribute('data-checkbox')) {
      return false
    }

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
    return true
  }, [autoCheckbox, editorRef, emitChange])

  /**
   * Detects `[]` pattern typed by user and converts to a checkbox span.
   */
  const detectCheckboxPattern = useCallback((sel: Selection): void => {
    const node = sel.anchorNode
    if (!node || node.nodeType !== Node.TEXT_NODE) return

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
  }, [])

  return {
    handleCheckboxClick,
    handleCheckboxBackspace,
    detectCheckboxPattern,
  }
}
