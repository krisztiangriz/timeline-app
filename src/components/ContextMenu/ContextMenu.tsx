import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode, type ReactElement, cloneElement } from 'react'
import styles from './ContextMenu.module.css'

// Stored before menu unmounts so Modal can restore focus to the anchor button.
// Mutable object so Modal can clear it without needing a setter export.
export const lastMenuAnchorRef: { current: HTMLElement | null } = { current: null }

export type MenuEntry =
  | { type: 'item'; label: string; onClick: () => void }
  | { type: 'separator' }

interface ContextMenuProps {
  items: MenuEntry[]
  trigger: ReactNode
}

export function ContextMenu({ items, trigger }: ContextMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const actionItems = useMemo(
    () => items.filter((e): e is { type: 'item'; label: string; onClick: () => void } => e.type === 'item'),
    [items]
  )

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom,
        right: window.innerWidth - rect.right,
      })
      setActiveIndex(0)
    }
  }, [open])

  // Focus the active menu item
  useEffect(() => {
    if (!open || activeIndex < 0 || !menuRef.current) return
    const buttons = menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]')
    buttons[activeIndex]?.focus()
  }, [open, activeIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < actionItems.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : actionItems.length - 1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (activeIndex >= 0 && actionItems[activeIndex]) {
          actionItems[activeIndex].onClick()
          setOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.querySelector<HTMLElement>('button, [tabindex="0"]')?.focus()
        break
    }
  }, [open, activeIndex, actionItems])

  return (
    <div className={styles.wrapper} ref={triggerRef} onKeyDown={handleKeyDown}>
      {cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        onClick: () => setOpen((v) => !v),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} role="presentation" />
          <div
            ref={menuRef}
            className={styles.menu}
            style={{ top: pos.top, right: pos.right }}
            role="menu"
          >
            {items.map((entry, i) => {
              if (entry.type === 'separator') {
                return <div key={`sep-${i}`} className={styles.separator} role="separator" />
              }
              const itemIndex = actionItems.indexOf(entry)
              return (
                <button
                  key={entry.label}
                  className={styles.item}
                  role="menuitem"
                  tabIndex={itemIndex === activeIndex ? 0 : -1}
                  onClick={() => {
                    lastMenuAnchorRef.current = triggerRef.current?.querySelector<HTMLElement>(
                      'button, [tabindex="0"]'
                    ) ?? null
                    entry.onClick()
                    setOpen(false)
                  }}
                >
                  {entry.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
