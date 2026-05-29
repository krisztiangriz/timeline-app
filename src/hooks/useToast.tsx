import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastMessage {
  id: number
  text: string
  action?: ToastAction
}

interface ToastContextValue {
  toasts: ToastMessage[]
  show: (text: string, action?: ToastAction) => void
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
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const show = useCallback(
    (text: string, action?: ToastAction) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, text, action }])
      // Undo toasts get longer duration (5s)
      const timeout = action ? 5000 : duration
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        timersRef.current.delete(id)
      }, timeout)
      timersRef.current.set(id, timer)
    },
    [duration]
  )

  return (
    <ToastContext.Provider value={{ toasts, show }}>
      {children}
    </ToastContext.Provider>
  )
}
