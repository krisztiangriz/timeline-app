import { useState, useRef, useEffect, Fragment, type ReactNode } from 'react'
import type { Tab } from '../../types'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  name: string
  onUpdateName: (name: string) => void
  tabs?: Tab[]
  activeTabId?: number | null
  onTabChange?: (tabId: number) => void
  /** If true, title is not editable (e.g., Home page) */
  readOnly?: boolean
  /** Optional actions rendered to the right of the title */
  actions?: ReactNode
}

export function PageHeader({
  name,
  onUpdateName,
  tabs = [],
  activeTabId,
  onTabChange,
  readOnly = false,
  actions,
}: PageHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(name) }, [name])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function handleSave() {
    const trimmed = editValue.trim()
    const newName = trimmed || 'Untitled'
    if (newName !== name) {
      onUpdateName(newName)
    }
    setEditValue(newName)
    setEditing(false)
  }

  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        {editing && !readOnly ? (
          <input
            ref={inputRef}
            className={styles.titleInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') { setEditValue(name); setEditing(false) }
            }}
            onBlur={handleSave}
          />
        ) : (
          <div
            className={styles.title}
            onClick={readOnly ? undefined : () => setEditing(true)}
            style={{ cursor: readOnly ? 'default' : 'text' }}
          >
            {name}
          </div>
        )}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      {tabs.length > 1 && (
        <div className={styles.tabGroup}>
          {tabs.map((tab, i) => (
            <Fragment key={tab.id}>
              {i > 0 && <div className={styles.tabSeparator} />}
              <button
                className={activeTabId === tab.id ? styles.tab : styles.tabInactive}
                onClick={() => onTabChange?.(tab.id!)}
              >
                {tab.name}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
