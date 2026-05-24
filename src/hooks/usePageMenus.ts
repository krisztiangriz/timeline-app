import { useCallback, useMemo } from 'react'
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
  onArchive?: () => void
  onRequestDelete?: () => void
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
  onArchive,
  onRequestDelete,
  deletePage,
  pageName,
  showToast,
}: UsePageMenusOptions) {
  const { setSettingsOpen, setHelpOpen } = useModalContext()
  const navigate = useNavigate()

  const handleDelete = useCallback(async () => {
    if (!pageId || !deletePage || !pageName) return
    await deletePage(pageId)
    showToast?.('Page deleted')
    navigate(deleteRedirect)
  }, [pageId, deletePage, pageName, showToast, navigate, deleteRedirect])

  const moreMenuItems = useMemo<MenuEntry[]>(() => {
    const items: MenuEntry[] = []

    if (onEditPage) {
      items.push({ type: 'item', label: 'Edit', onClick: onEditPage })
    }

    items.push({ type: 'item', label: 'Settings', onClick: () => setSettingsOpen(true) })
    items.push({ type: 'item', label: 'Help', onClick: () => setHelpOpen(true) })

    if (canArchive && onArchive) {
      items.push({ type: 'separator' })
      items.push({ type: 'item', label: isArchived ? 'Unarchive' : 'Archive', onClick: onArchive })
    }

    if (canDelete && pageId && deletePage) {
      if (!canArchive) items.push({ type: 'separator' })
      items.push({ type: 'item', label: 'Delete', onClick: onRequestDelete ?? handleDelete })
    }

    return items
  }, [onEditPage, canArchive, onArchive, isArchived, canDelete, pageId, deletePage, onRequestDelete, handleDelete, setSettingsOpen, setHelpOpen])

  return { moreMenuItems }
}
