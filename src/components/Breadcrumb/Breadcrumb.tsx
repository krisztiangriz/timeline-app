import { Link } from 'react-router-dom'
import type { BreadcrumbItem } from '../../types'
import { useAppContext } from '../../hooks/useAppContext'
import { SearchBar } from '../SearchBar/SearchBar'
import { ContextMenu, type MenuEntry } from '../ContextMenu/ContextMenu'
import { PlusIcon, SearchIcon } from '../Icons/Icons'
import styles from './Breadcrumb.module.css'

interface BreadcrumbNavProps {
  items: BreadcrumbItem[]
  addMenuItems?: MenuEntry[]
  moreMenuItems?: MenuEntry[]
}

export function BreadcrumbNav({
  items,
  addMenuItems,
  moreMenuItems,
}: BreadcrumbNavProps) {
  const { searchOpen, setSearchOpen, setAddPageOpen } = useAppContext()

  const addTrigger = (
    <button className={styles.actionButton} aria-label="Add">
      <PlusIcon />
    </button>
  )

  const moreTrigger = (
    <button className={styles.actionButton} aria-label="More">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="4" cy="9" r="1.5" fill="currentColor" />
        <circle cx="9" cy="9" r="1.5" fill="currentColor" />
        <circle cx="14" cy="9" r="1.5" fill="currentColor" />
      </svg>
    </button>
  )

  return (
    <div className={styles.header}>
      {searchOpen ? (
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchBar
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            onAddPage={() => { setSearchOpen(false); setAddPageOpen(true) }}
          />
        </div>
      ) : (
        <>
          <div className={styles.breadcrumbs}>
            {items.map((item, i) => {
              const isLast = i === items.length - 1
              return (
                <span key={item.path} style={{ display: 'contents' }}>
                  {i > 0 && <span className={styles.separator}>/</span>}
                  {isLast ? (
                    <span className={styles.crumbCurrent}>{item.label}</span>
                  ) : (
                    <Link to={item.path} className={styles.crumb}>
                      {item.label}
                    </Link>
                  )}
                </span>
              )
            })}
          </div>

          <button
            className={styles.actionButton}
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <SearchIcon />
          </button>
        </>
      )}

      <div className={styles.actions}>
        {addMenuItems && addMenuItems.length > 0 && (
          <ContextMenu items={addMenuItems} trigger={addTrigger} />
        )}

        {moreMenuItems && moreMenuItems.length > 0 && (
          <ContextMenu items={moreMenuItems} trigger={moreTrigger} />
        )}
      </div>
    </div>
  )
}
