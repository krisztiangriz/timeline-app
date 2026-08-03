import { memo, useMemo, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPagePath } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { enrichMentionHtml } from '../../utils/mentionEnricher'
import styles from './RichTextEditor.module.css'

import { subscribePurify, getPurifyLoaded, sanitizeForDisplay } from '../../utils/domPurify'

interface RichTextDisplayProps {
  html: string
  /** When true, mentions with collapsed hubs show only the trigger character */
  collapseMentions?: boolean
}

export const RichTextDisplay = memo(function RichTextDisplay({ html, collapseMentions }: RichTextDisplayProps) {
  const navigate = useNavigate()
  const { allPages } = useAutocomplete()
  const isLoaded = useSyncExternalStore(subscribePurify, getPurifyLoaded)

  const cleanHtml = useMemo(() => {
    const sanitized = sanitizeForDisplay(html)
    if (!sanitized) return ''
    let enriched = enrichMentionHtml(sanitized, allPages, collapseMentions)
    // Ensure all links open in new tab (only add if not already present)
    enriched = enriched.replace(/<a(?![^>]*target=)/g, '<a target="_blank" rel="noopener noreferrer"')
    return enriched
  }, [html, allPages, collapseMentions, isLoaded])

  if (!html || html === '<br>' || !isLoaded) {
    return null
  }

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement

    // Open links in new tab
    const link = target.closest('a[href]') as HTMLAnchorElement | null
    if (link) {
      e.stopPropagation()
      e.preventDefault()
      window.open(link.href, '_blank', 'noopener,noreferrer')
      return
    }

    const mention = target.closest('[data-page-id]') as HTMLElement | null
    if (mention) {
      e.stopPropagation()
      navigateToMention(mention)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const target = e.target as HTMLElement
    const mention = target.closest('[data-page-id]') as HTMLElement | null
    if (mention) {
      e.preventDefault()
      navigateToMention(mention)
    }
  }

  function navigateToMention(mention: HTMLElement) {
    const pageId = Number(mention.getAttribute('data-page-id'))
    if (pageId) {
      const page = allPages.find((p) => p.id === pageId)
      if (page) {
        navigate(getPagePath(page, allPages))
      } else {
        navigate(`/page/${pageId}`)
      }
    }
  }

  return (
    <div
      className={styles.editor}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  )
})
