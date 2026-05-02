import { useState, useRef, useEffect, type ReactNode } from 'react'
import styles from './ContextMenu.module.css'

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
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom,
        right: window.innerWidth - rect.right,
      })
    }
  }, [open])

  return (
    <div className={styles.wrapper} ref={triggerRef}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div
            className={styles.menu}
            style={{ top: pos.top, right: pos.right }}
          >
            {items.map((entry, i) => {
              if (entry.type === 'separator') {
                return <div key={`sep-${i}`} className={styles.separator} />
              }
              return (
                <button
                  key={entry.label}
                  className={styles.item}
                  onClick={() => {
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
