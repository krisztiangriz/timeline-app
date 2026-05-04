import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModalContext } from './useAppContext'
import type { MenuEntry } from '../components/ContextMenu/ContextMenu'

interface UsePageMenusOptions {
  pageId?: number
  canDelete?: boolean
  canArchive?: boolean
  isArchived?: boolean
  deleteRedirect?: string
  onEditPage?: () => void
  onRearrange?: () => void
  onArchive?: () => void
  deletePage?: (id: number) => Promise<void>
  pageName?: string
  showToast?: (msg: string) => void
}

export function usePageMenus({
  pageId,
  canDelete = false,
  canArchive = false,
  isArchived = false,
  deleteRedirect = '/',
  onEditPage,
  onRearrange,
  onArchive,
  deletePage,
  pageName,
  showToast,
}: UsePageMenusOptions) {
  const { setFeedbackOpen, setAddPageOpen, setSettingsOpen, setHelpOpen } = useModalContext()
  const navigate = useNavigate()

  const handleDelete = useCallback(async () => {
    if (!pageId || !deletePage || !pageName) return
    if (!window.confirm(`Delete "${pageName}"? This will delete all associated entries, feedback, and layouts.`)) return
    await deletePage(pageId)
    showToast?.('Page deleted')
    navigate(deleteRedirect)
  }, [pageId, deletePage, pageName, showToast, navigate, deleteRedirect])

  const addMenuItems: MenuEntry[] = [
    { type: 'item', label: 'Add feedback', onClick: () => setFeedbackOpen(true) },
    { type: 'separator' },
    { type: 'item', label: 'Add page', onClick: () => setAddPageOpen(true) },
  ]

  const moreMenuItems: MenuEntry[] = []

  if (onEditPage) {
    moreMenuItems.push({ type: 'item', label: 'Edit page', onClick: onEditPage })
  }

  if (onRearrange) {
    moreMenuItems.push({ type: 'item', label: 'Rearrange', onClick: onRearrange })
  }

  moreMenuItems.push({ type: 'item', label: 'Settings', onClick: () => setSettingsOpen(true) })
  moreMenuItems.push({ type: 'item', label: 'Help', onClick: () => setHelpOpen(true) })

  if (canArchive && onArchive) {
    moreMenuItems.push({ type: 'separator' })
    moreMenuItems.push({ type: 'item', label: isArchived ? 'Unarchive' : 'Archive', onClick: onArchive })
  }

  if (canDelete && pageId && deletePage) {
    if (!canArchive) moreMenuItems.push({ type: 'separator' })
    moreMenuItems.push({ type: 'item', label: 'Delete', onClick: handleDelete })
  }

  return { addMenuItems, moreMenuItems }
}
