import { useEffect, useState, useCallback, useRef } from 'react'
import { downloadBackup } from '../utils/exportImport'
import { safeGetItem, safeSetItem } from '../utils/safeStorage'
import { useToast } from './useToast'

export type BackupFrequency = 'daily' | 'weekly' | 'monthly' | 'off'

const LS_FREQUENCY = 'backup-frequency'
const LS_LAST = 'backup-last'

const INTERVALS: Record<Exclude<BackupFrequency, 'off'>, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

function getFrequency(): BackupFrequency {
  const v = safeGetItem(LS_FREQUENCY)
  if (v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'off') return v
  return 'off'
}

function getLastBackup(): string | null {
  return safeGetItem(LS_LAST)
}

function isDue(frequency: BackupFrequency): boolean {
  if (frequency === 'off') return false
  const last = getLastBackup()
  if (!last) return true
  const elapsed = Date.now() - new Date(last).getTime()
  return elapsed >= INTERVALS[frequency]
}

/**
 * Runs once on app load. If a backup is due, triggers a JSON file download.
 */
export function useAutoBackup() {
  const { show: showToast } = useToast()
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast

  useEffect(() => {
    const frequency = getFrequency()
    if (!isDue(frequency)) return

    // Re-check right before downloading (guards against multiple tabs)
    const run = async () => {
      if (!isDue(getFrequency())) return
      try {
        await downloadBackup()
        safeSetItem(LS_LAST, new Date().toISOString())
        showToastRef.current('Backup saved')
      } catch {
        showToastRef.current('Backup failed — export manually from Settings')
      }
    }

    // Small delay so the app finishes rendering before triggering the download
    const timer = setTimeout(run, 2000)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — uses ref for toast, timer must be stable
}

/**
 * Hook for the Settings UI to read/write backup preferences.
 */
export function useBackupSettings() {
  const [frequency, setFrequencyState] = useState<BackupFrequency>(getFrequency)
  const [lastBackup] = useState<string | null>(getLastBackup)

  const setFrequency = useCallback((v: BackupFrequency) => {
    setFrequencyState(v)
    safeSetItem(LS_FREQUENCY, v)
  }, [])

  return { frequency, setFrequency, lastBackup }
}
