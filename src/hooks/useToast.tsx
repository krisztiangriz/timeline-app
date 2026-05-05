import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export interface ToastMessage {
  id: number
  text: string
}

interface ToastContextValue {
  toasts: ToastMessage[]
  show: (text: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  show: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children, duration = 3000 }: { children: ReactNode; duration?: number }) {
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

  return (
    <ToastContext.Provider value={{ toasts, show }}>
      {children}
    </ToastContext.Provider>
  )
}
