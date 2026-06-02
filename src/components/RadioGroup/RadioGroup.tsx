import { useRadioGroupKeyboard } from '../../hooks/useRadioGroupKeyboard'
import radio from '../../styles/radio.module.css'

export interface RadioOption<T extends string | number> {
  value: T
  label: string
  description?: string
  disabled?: boolean
}

interface RadioGroupProps<T extends string | number> {
  options: RadioOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  buttonClassName?: string
  disabledButtonClassName?: string
}

export function RadioGroup<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
  disabledButtonClassName,
}: RadioGroupProps<T>) {
  const { groupRef, handleKeyDown } = useRadioGroupKeyboard(
    options.map((o) => o.value),
    value,
    onChange,
    (v) => options.find((o) => o.value === v)?.disabled ?? false,
  )

  return (
    <div
      ref={groupRef}
      className={className}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        const cls = opt.disabled
          ? (disabledButtonClassName ?? radio.radioOption)
          : (buttonClassName ?? radio.radioOption)
        return (
          <button
            key={String(opt.value)}
            className={cls}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={opt.disabled}
            onClick={opt.disabled ? undefined : () => onChange(opt.value)}
          >
            <div className={radio.radioCircle} data-checked={selected} />
            <span>{opt.label}</span>
            {opt.description && <span>{opt.description}</span>}
          </button>
        )
      })}
    </div>
  )
}
