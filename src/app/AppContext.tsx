import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Settings } from '@/domain/types'
import { AppCtx, HeaderContext, type AppState } from './contexts'
export { HeaderContext } from './contexts'
export type { PageMeta } from './contexts'
import { bootstrap } from '@/data/bootstrap'
import { getSettings } from '@/data/services/settings'
import { subscribe } from '@/data/events'
import { todayInTz } from '@/domain/dates'
import { StorageError, toStorageError } from '@/data/errors'

export function useApp(): AppState {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}

export function AppProvider({ children, fallback, onStorageError }: { children: ReactNode; fallback: ReactNode; onStorageError: (err: StorageError, retry: () => void) => ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<StorageError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [clock, setClock] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    setError(null)
    bootstrap()
      .then((s) => {
        if (!cancelled) setSettings(s)
      })
      .catch((err) => {
        if (!cancelled) setError(toStorageError(err))
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const refreshSettings = useCallback(async () => {
    const s = await getSettings()
    setSettings(s)
  }, [])

  useEffect(() => subscribe((e) => {
    if (e.stores.includes('settings')) void refreshSettings()
  }), [refreshSettings])

  // Re-evaluate "today" once a minute so the date rolls over at midnight.
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const value = useMemo<AppState | null>(() => {
    if (!settings) return null
    return { settings, timezone: settings.timezone, today: todayInTz(settings.timezone, new Date(clock)), refreshSettings }
  }, [settings, clock, refreshSettings])

  if (error) return <>{onStorageError(error, () => setAttempt((a) => a + 1))}</>
  if (!value) return <>{fallback}</>
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function usePage(title: string, description?: string, opts: { header?: boolean } = {}): void {
  const { setMeta } = useContext(HeaderContext)
  const header = opts.header
  useEffect(() => {
    setMeta({ title, description, header })
    const prev = document.title
    document.title = `${title} · GymBook`
    const metaEl = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prevDesc = metaEl?.content
    if (metaEl && description) metaEl.content = description
    return () => {
      document.title = prev
      if (metaEl && prevDesc !== undefined) metaEl.content = prevDesc
    }
  }, [title, description, header, setMeta])
}
