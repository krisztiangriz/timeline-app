import { useRef, useCallback } from 'react'

/**
 * Returns { groupRef, handleKeyDown } for a radiogroup container.
 * Implements roving tabIndex via arrow-key navigation.
 * The caller is responsible for setting tabIndex on each radio button.
 */
export function useRadioGroupKeyboard<T>(
  options: T[],
  value: T,
  onChange: (v: T) => void,
  isDisabled?: (v: T) => boolean,
) {
  const groupRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowRight' &&
        e.key !== 'ArrowUp' && e.key !== 'ArrowLeft') return
    e.preventDefault()

    const enabled = isDisabled ? options.filter((o) => !isDisabled(o)) : options
    const currentIndex = enabled.indexOf(value)
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight'
      ? (currentIndex + 1) % enabled.length
      : (currentIndex - 1 + enabled.length) % enabled.length
    onChange(enabled[next])

    const buttons = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')
    buttons?.[next]?.focus()
  }, [options, value, onChange, isDisabled])

  return { groupRef, handleKeyDown }
}
