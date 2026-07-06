import { useState, useCallback, useMemo } from 'react'

export function useSeriesFilter(keys: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const validSelected = useMemo(() => {
    const keySet = new Set(keys)
    const filtered = new Set([...selected].filter(k => keySet.has(k)))
    return filtered.size === selected.size ? selected : filtered
  }, [keys, selected])

  const toggle = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const opacity = useCallback((key: string) =>
    validSelected.size === 0 ? 1 : validSelected.has(key) ? 1 : 0.25
  , [validSelected])

  const isActive = useCallback((key: string) =>
    validSelected.size === 0 ? true : validSelected.has(key)
  , [validSelected])

  return { selected: validSelected, toggle, opacity, isActive }
}
