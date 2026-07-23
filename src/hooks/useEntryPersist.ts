import { useCallback } from 'react'
import { stripHtml } from '../utils/stripHtml'
import { addEntry, updateEntry, deleteEntry } from './useTimeline'
import type { ToastAction } from './useToast'

interface EntryPersistOptions {
  pageId: number
  isPending: boolean
  date?: Date
  textTransform?: (html: string) => string
  wrapOnCreate?: (html: string) => string
}

async function persistEntry(
  html: string,
  entryIdRef: React.MutableRefObject<number | undefined>,
  options: EntryPersistOptions,
) {
  const { pageId, isPending, date, textTransform, wrapOnCreate } = options
  const stripped = textTransform ? textTransform(html) : stripHtml(html).trim()
  if (entryIdRef.current) {
    if (!stripped) {
      await deleteEntry(entryIdRef.current)
      entryIdRef.current = undefined
    } else {
      await updateEntry(entryIdRef.current, { text: html })
    }
  } else if (stripped) {
    const finalHtml = wrapOnCreate ? (wrapOnCreate(html) || html) : html
    const id = await addEntry({ pageId, text: finalHtml, isPending, date })
    entryIdRef.current = id
  }
}

export function useEntrySave(
  entryIdRef: React.MutableRefObject<number | undefined>,
  options: EntryPersistOptions,
  showToast: (msg: string) => void,
) {
  const save = useCallback(async (html: string) => {
    try { await persistEntry(html, entryIdRef, options) }
    catch { showToast('Failed to save') }
  }, [options.pageId, options.isPending, options.date, options.textTransform, options.wrapOnCreate, showToast, entryIdRef])

  const autoSave = useCallback(async (html: string) => {
    try { await persistEntry(html, entryIdRef, options) }
    catch { /* auto-save failure — non-critical */ }
  }, [options.pageId, options.isPending, options.date, options.textTransform, options.wrapOnCreate, entryIdRef])

  return { save, autoSave }
}

export function useEntryDelete(
  pageId: number,
  isPending: boolean,
  showToast: (msg: string, action?: ToastAction) => void,
) {
  return useCallback(async (
    entryIdRef: React.MutableRefObject<number | undefined>,
    savedHtml: string,
    savedDate: Date | undefined,
    savedCreatedAt: Date | undefined,
    onDeleted: () => void,
    guardRestore?: () => boolean,
  ) => {
    if (!entryIdRef.current) return
    const entryId = entryIdRef.current
    try {
      await deleteEntry(entryId)
    } catch { showToast('Failed to delete'); return }
    onDeleted()
    showToast('Deleted', {
      label: 'Undo',
      onClick: async () => {
        if (guardRestore?.()) return
        const id = await addEntry({
          pageId, text: savedHtml, isPending,
          date: savedDate ?? new Date(),
          createdAt: savedCreatedAt ?? new Date(),
        })
        entryIdRef.current = id
      },
    })
  }, [pageId, isPending, showToast])
}
