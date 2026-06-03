export function normalizeExternalHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
  const toProcess: HTMLElement[] = []
  while (walker.nextNode()) {
    toProcess.push(walker.currentNode as HTMLElement)
  }

  for (const el of toProcess) {
    if (!(el instanceof HTMLElement) || !el.style) continue

    const weight = el.style.fontWeight
    if (weight === 'bold' || weight === 'bolder' || parseInt(weight) >= 700) {
      wrapChildrenIn(doc, el, 'b')
      el.style.fontWeight = ''
    }

    if (el.style.fontStyle === 'italic') {
      wrapChildrenIn(doc, el, 'i')
      el.style.fontStyle = ''
    }

    if (el.style.textDecoration?.includes('underline') ||
        el.style.textDecorationLine?.includes('underline')) {
      wrapChildrenIn(doc, el, 'u')
      el.style.textDecoration = ''
      el.style.textDecorationLine = ''
    }

    if (!el.getAttribute('style')?.trim()) {
      el.removeAttribute('style')
    }
  }

  convertBlocksToBr(doc)
  removeEmptySpans(doc)
  convertNewlinesToBr(doc)

  return doc.body.innerHTML
}

function wrapChildrenIn(doc: Document, parent: HTMLElement, tag: string) {
  const wrapper = doc.createElement(tag)
  while (parent.firstChild) {
    wrapper.appendChild(parent.firstChild)
  }
  parent.appendChild(wrapper)
}

function convertBlocksToBr(doc: Document) {
  const paragraphs = Array.from(doc.querySelectorAll('p'))
  for (const p of paragraphs) {
    const fragment = doc.createDocumentFragment()
    while (p.firstChild) {
      fragment.appendChild(p.firstChild)
    }
    fragment.appendChild(doc.createElement('br'))
    p.replaceWith(fragment)
  }
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'PRE', 'BLOCKQUOTE'])

function convertNewlinesToBr(doc: Document) {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.nodeValue?.includes('\n')) textNodes.push(node)
  }
  for (const node of textNodes) {
    if (isInterBlockWhitespace(node)) {
      node.remove()
      continue
    }
    const parts = node.nodeValue!.split('\n')
    const fragment = doc.createDocumentFragment()
    parts.forEach((part, i) => {
      if (part) fragment.appendChild(doc.createTextNode(part))
      if (i < parts.length - 1) fragment.appendChild(doc.createElement('br'))
    })
    node.replaceWith(fragment)
  }
}

function isInterBlockWhitespace(node: Text): boolean {
  if (node.nodeValue?.trim()) return false
  const parent = node.parentElement
  if (!parent) return true
  const prev = node.previousSibling
  const next = node.nextSibling
  const prevIsBlock = prev && prev.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((prev as Element).tagName)
  const nextIsBlock = next && next.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((next as Element).tagName)
  return !!(prevIsBlock || nextIsBlock || parent === node.ownerDocument.body)
}

function removeEmptySpans(doc: Document) {
  const spans = Array.from(doc.querySelectorAll('span'))
  for (const span of spans) {
    const hasOnlyEmptyStyle = span.attributes.length === 1 && span.hasAttribute('style') && !span.getAttribute('style')?.trim()
    if (!span.attributes.length || hasOnlyEmptyStyle) {
      span.replaceWith(...Array.from(span.childNodes))
    }
  }
}
