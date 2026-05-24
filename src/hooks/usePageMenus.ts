import { useMemo } from 'react'
import { useModalContext } from './useAppContext'
import type { MenuEntry } from '../components/ContextMenu/ContextMenu'

interface UsePageMenusOptions {
  canDelete?: boolean
  canArchive?: boolean
  isArchived?: boolean
  onEditPage?: () => void
  onArchive?: () => void
  onRequestDelete?: () => void
}

export function usePageMenus({
  canDelete = false,
  canArchive = false,
  isArchived = false,
  onEditPage,
  onArchive,
  onRequestDelete,
}: UsePageMenusOptions) {
  const { setSettingsOpen, setHelpOpen } = useModalContext()

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

    if (canDelete && onRequestDelete) {
      if (!canArchive) items.push({ type: 'separator' })
      items.push({ type: 'item', label: 'Delete', onClick: onRequestDelete })
    }

    return items
  }, [onEditPage, canArchive, onArchive, isArchived, canDelete, onRequestDelete, setSettingsOpen, setHelpOpen])

  return { moreMenuItems }
}
