import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { getPagePath } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import styles from './RichTextEditor.module.css'

interface RichTextDisplayProps {
  html: string
  className?: string
  onClick?: () => void
}

/**
 * Read-only display of rich text HTML content.
 * Clicking a mention navigates to the referenced page.
 */
export const RichTextDisplay = memo(function RichTextDisplay({ html, className, onClick }: RichTextDisplayProps) {
  const navigate = useNavigate()
  const { allPages } = useAutocomplete()
  const displayClassName = [styles.editor, className].filter(Boolean).join(' ')
  const cleanHtml = useMemo(() => DOMPurify.sanitize(html), [html])

  if (!html || html === '<br>') {
    return null
  }

  function handleClick(e: React.MouseEvent) {
    // Check if click target is a mention with a page ID
    const target = e.target as HTMLElement
    const mention = target.closest('[data-page-id]') as HTMLElement | null
    if (mention) {
      e.stopPropagation()
      const pageId = Number(mention.getAttribute('data-page-id'))
      if (pageId) {
        const page = allPages.find((p) => p.id === pageId)
        if (page) {
          navigate(getPagePath(page, allPages))
        } else {
          navigate(`/page/${pageId}`)
        }
        return
      }
    }
    // Fall through to the regular onClick
    onClick?.()
  }

  return (
    <div
      className={displayClassName}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      onClick={handleClick}
      style={{ cursor: onClick ? 'text' : undefined }}
    />
  )
})
