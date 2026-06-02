import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSearch } from '../../hooks/useSearch'
import { getPagePath } from '../../hooks/usePages'
import { useAutocomplete } from '../../hooks/useAutocomplete'
import { SearchIcon, PlusIcon } from '../Icons/Icons'
import { formatTableDate } from '../../utils/dateUtils'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  open: boolean
  onClose: () => void
  onAddPage: () => void
}

export function SearchBar({ open, onClose, onAddPage }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const results = useSearch(query)
  const { allPages } = useAutocomplete()

  // Total selectable items: results + "Add new page"
  const totalItems = results.length + 1

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1)
  }, [results.length])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const items = listRef.current.children
    const el = items[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const selectItem = useCallback(
    (index: number) => {
      if (index >= 0 && index < results.length) {
        const page = results[index]
        navigate(getPagePath(page, allPages))
        onClose()
      } else if (index === results.length) {
        onAddPage()
        onClose()
      }
    },
    [results, allPages, navigate, onClose, onAddPage]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => {
        if (!query.trim()) return prev
        return prev < totalItems - 1 ? prev + 1 : 0
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => {
        if (!query.trim()) return prev
        return prev > 0 ? prev - 1 : totalItems - 1
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0) {
        selectItem(activeIndex)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="presentation" />
      <div className={styles.container}>
        <div className={styles.inputWrapper}>
          <SearchIcon />
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            aria-label="Search pages"
            role="combobox"
            aria-expanded={!!query.trim()}
            aria-haspopup="listbox"
            aria-controls="search-listbox"
            aria-activedescendant={activeIndex >= 0 ? `search-option-${activeIndex}` : undefined}
          />
          {query && (
            <button className={styles.clearButton} onClick={() => setQuery('')} aria-label="Clear search">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {query.trim() && (
          <div className={styles.dropdown} ref={listRef} id="search-listbox" role="listbox">
            {results.map((page, i) => (
              <button
                key={page.id}
                id={`search-option-${i}`}
                className={i === activeIndex ? styles.resultActive : styles.result}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => {
                  navigate(getPagePath(page, allPages))
                  onClose()
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span>{page.name}</span>
                <span className={styles.resultDate}>
                  {formatTableDate(page.updatedAt)}
                </span>
              </button>
            ))}
            <button
              id={`search-option-${results.length}`}
              className={activeIndex === results.length ? styles.addNewActive : styles.addNew}
              role="option"
              aria-selected={activeIndex === results.length}
              onClick={() => {
                onAddPage()
                onClose()
              }}
              onMouseEnter={() => setActiveIndex(results.length)}
            >
              <PlusIcon size={12} />
              Add new page
            </button>
          </div>
        )}
      </div>
    </>
  )
}
