import { useMemo } from 'react'
import { usePageByRole, useChildPages } from '../../hooks/usePages'
import { useTimelineEntries } from '../../hooks/useTimeline'
import { updateEntry, deleteEntry, addEntry } from '../../hooks/useTimeline'
import { stripHtml } from '../../utils/stripHtml'
import { RichTextDisplay } from '../RichTextEditor/RichTextDisplay'
import styles from './HubPendingSection.module.css'

/** Strip data-checkbox spans from HTML, keeping inner text */
function stripCheckboxHtml(html: string): string {
  return html.replace(/<span data-checkbox="[^"]*">([\s\S]*?)<\/span>/g, '$1').trim()
}

/** Convert HTML text to sentence case, preserving mention span content */
function toSentenceCase(html: string): string {
  let first = true
  let mentionDepth = 0
  return html.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) {
      if (/data-page-id/.test(tag)) mentionDepth++
      else if (tag === '</span>' && mentionDepth > 0) mentionDepth--
      return tag
    }
    if (mentionDepth > 0) return text
    let result = text.toLowerCase()
    if (first) {
      result = result.replace(/[a-z]/, (c: string) => c.toUpperCase())
      first = false
    }
    return result
  })
}

/** Split pending HTML into individual line strings (each <div> is one line) */
function splitPendingLines(html: string): string[] {
  if (!html.trim()) return []
  // Split on <div> boundaries
  const lines = html
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return lines
}

/** Rebuild pending HTML from remaining lines */
function rebuildPendingHtml(lines: string[]): string {
  if (lines.length === 0) return ''
  return lines.map((l) => `<div>${l}</div>`).join('')
}

interface HubPendingSectionProps {
  hubId: number
}

export function HubPendingSection({ hubId }: HubPendingSectionProps) {
  const timelinePage = usePageByRole('main-timeline')
  const allTimelineEntries = useTimelineEntries(timelinePage?.id)
  const children = useChildPages(hubId)

  // Find the pending entry from the main timeline
  const pendingEntry = useMemo(
    () => allTimelineEntries.find((e) => e.isPending),
    [allTimelineEntries]
  )

  // Build set of child page IDs for this hub
  const childIdStrings = useMemo(
    () => new Set(children.map((c) => String(c.id!))),
    [children]
  )

  // Split pending HTML into lines and filter for ones mentioning this hub's children
  const { relevantLines, allLines } = useMemo(() => {
    if (!pendingEntry?.text) return { relevantLines: [], allLines: [] }
    const all = splitPendingLines(pendingEntry.text)
    const relevant = all.filter((line) => {
      // Check if line contains a data-page-id matching any child
      const matches = line.match(/data-page-id="(\d+)"/g)
      if (!matches) return false
      return matches.some((m) => {
        const id = m.replace('data-page-id="', '').replace('"', '')
        return childIdStrings.has(id)
      })
    })
    return { relevantLines: relevant, allLines: all }
  }, [pendingEntry?.text, childIdStrings])

  // Don't render if no relevant pending items
  if (relevantLines.length === 0) return null

  async function handleComplete(lineIndex: number) {
    if (!pendingEntry?.id || !timelinePage?.id) return

    const targetLine = relevantLines[lineIndex]
    const cleanText = toSentenceCase(
      stripCheckboxHtml(targetLine).replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ').trim()
    )

    // Remove the line from the full pending HTML
    const originalIndex = allLines.indexOf(targetLine)
    if (originalIndex === -1) return
    const remaining = [...allLines]
    remaining.splice(originalIndex, 1)
    const newHtml = rebuildPendingHtml(remaining)

    // Update or delete the pending entry
    const plain = stripHtml(newHtml).trim()
    if (plain) {
      await updateEntry(pendingEntry.id, { text: newHtml })
    } else {
      await deleteEntry(pendingEntry.id)
    }

    // Append to today's entry on the main timeline
    if (cleanText) {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEntry = allTimelineEntries.find(
        (e) => !e.isPending && new Date(e.date) >= todayStart && e.pageId === timelinePage.id
      )

      if (todayEntry?.id) {
        const newText = todayEntry.text
          ? todayEntry.text + '<div>' + cleanText + '</div>'
          : cleanText
        await updateEntry(todayEntry.id, { text: newText })
      } else {
        await addEntry({ pageId: timelinePage.id, text: cleanText, isPending: false })
      }
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.content}>
        {relevantLines.map((lineHtml, i) => (
          <div key={i} className={styles.pendingLine}>
            <span
              className={styles.checkbox}
              onClick={() => handleComplete(i)}
            />
            <RichTextDisplay html={stripCheckboxHtml(lineHtml)} collapseMentions />
          </div>
        ))}
      </div>
      <span className={styles.dateLabel}>Pending</span>
    </div>
  )
}
