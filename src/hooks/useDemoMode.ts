import { useState, useCallback } from 'react'

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState(
    () => localStorage.getItem('demo-mode') === 'true',
  )

  const clearDemoFlag = useCallback(() => {
    localStorage.removeItem('demo-mode')
    setIsDemoMode(false)
  }, [])

  return { isDemoMode, clearDemoFlag }
}
