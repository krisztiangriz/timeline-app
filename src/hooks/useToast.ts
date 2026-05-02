import { useCallback, useRef, useState } from 'react'

export interface ToastMessage {
  id: number
  text: string
}

export function useToast(duration = 3000) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextId = useRef(0)

  const show = useCallback(
    (text: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, text }])

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    },
    [duration]
  )

  return { toasts, show }
}
