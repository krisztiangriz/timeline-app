import { useState, useCallback } from 'react'
import { updatePage, updateTabs, archivePage, unarchivePage } from './usePages'
import type { PageFormData } from '../components/PageForm/PageForm'
import type { Page } from '../types'

export function usePageActions(
  page: Page | undefined,
  showToast: (msg: string) => void,
) {
  const [editPageOpen, setEditPageOpen] = useState(false)

  const handleArchive = useCallback(async () => {
    if (!page?.id) return
    if (page.archived) {
      await unarchivePage(page.id)
      showToast('Unarchived')
    } else {
      await archivePage(page.id)
      showToast('Archived')
    }
  }, [page, showToast])

  const handleEditSubmit = useCallback(async (data: PageFormData) => {
    if (!page?.id) return
    try {
      await updatePage(page.id, { name: data.name, mentionTrigger: data.mentionTrigger, mentionCollapsed: data.mentionCollapsed, hideChart: data.hideChart })
      await updateTabs(page.id, data.tabs)
      setEditPageOpen(false)
      showToast('Page updated')
    } catch {
      showToast('Failed to update page')
    }
  }, [page, showToast])

  return { handleArchive, handleEditSubmit, editPageOpen, setEditPageOpen }
}
