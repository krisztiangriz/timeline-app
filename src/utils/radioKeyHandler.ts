import type React from 'react'

export function makeRadioKeyHandler<T>(
  options: T[],
  current: T,
  onChange: (v: T) => void,
) {
  return (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowRight' &&
        e.key !== 'ArrowUp' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const idx = options.indexOf(current)
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight'
      ? (idx + 1) % options.length
      : (idx - 1 + options.length) % options.length
    onChange(options[next])
    const buttons = (e.currentTarget as HTMLDivElement).querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')
    buttons[next]?.focus()
  }
}
