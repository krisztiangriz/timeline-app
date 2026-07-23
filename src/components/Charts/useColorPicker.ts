import { useState, useCallback, useRef } from 'react'

export function useColorPicker() {
  const [pickerKey, setPickerKey] = useState<string | null>(null)
  const dotRef = useRef<HTMLElement | null>(null)
  const handleClose = useCallback(() => setPickerKey(null), [])

  const openPicker = useCallback((name: string, anchor: HTMLElement) => {
    dotRef.current = anchor
    setPickerKey(name)
  }, [])

  const selectAndClose = useCallback((onColorChange: (key: string, color: string) => void, color: string) => {
    if (pickerKey) {
      onColorChange(pickerKey, color)
      setPickerKey(null)
    }
  }, [pickerKey])

  return { pickerKey, dotRef, handleClose, openPicker, selectAndClose }
}
