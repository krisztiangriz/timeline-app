import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { getPagePath } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { enrichMentionHtml } from '../../utils/mentionEnricher'
import styles from './RichTextEditor.module.css'

interface RichTextDisplayProps {
  html: string
  className?: string
  onClick?: () => void
  /** When true, mentions with collapsed hubs show only the trigger character */
  collapseMentions?: boolean
  /** Optional: called when a mention is clicked. If not provided, navigates internally. */
  onMentionClick?: (pageId: number) => void
}

/**
 * Read-only display of rich text HTML content.
 * Clicking a mention navigates to the referenced page (or calls onMentionClick if provided).
 */
export const RichTextDisplay = memo(function RichTextDisplay({ html, className, onClick, collapseMentions, onMentionClick }: RichTextDisplayProps) {
  const navigate = useNavigate()
  const { allPages } = useAutocomplete()
  const displayClassName = [styles.editor, className].filter(Boolean).join(' ')
  const cleanHtml = useMemo(() => {
    let sanitized = enrichMentionHtml(DOMPurify.sanitize(html), allPages, collapseMentions)
    // Ensure all links open in new tab
    sanitized = sanitized.replace(/<a /g, '<a target="_blank" rel="noopener" ')
    return sanitized
  }, [html, allPages, collapseMentions])

  if (!html || html === '<br>') {
    return null
  }

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement

    // Open links in new tab
    const link = target.closest('a[href]') as HTMLAnchorElement | null
    if (link) {
      e.stopPropagation()
      e.preventDefault()
      window.open(link.href, '_blank', 'noopener')
      return
    }

    const mention = target.closest('[data-page-id]') as HTMLElement | null
    if (mention) {
      e.stopPropagation()
      const pageId = Number(mention.getAttribute('data-page-id'))
      if (pageId) {
        if (onMentionClick) {
          onMentionClick(pageId)
        } else {
          const page = allPages.find((p) => p.id === pageId)
          if (page) {
            navigate(getPagePath(page, allPages))
          } else {
            navigate(`/page/${pageId}`)
          }
        }
        return
      }
    }
    onClick?.()
  }

  return (
    <div
      className={displayClassName}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      onClick={handleClick}
      style={{ cursor: onClick ? 'text' : 'auto' }}
    />
  )
})
