import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribe, type StoreName } from '@/data/events'
import { errorMessage } from '@/data/errors'

export interface LiveQuery<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => void
  /** True when another tab changed data this query depends on since last load. */
  stale: boolean
}

/**
 * Run an async read and re-run it whenever any of the listed stores change,
 * in this tab or another. Keeps the last good result while reloading.
 */
export function useLiveQuery<T>(fn: () => Promise<T>, stores: StoreName[] | 'all', deps: unknown[] = []): LiveQuery<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const storesKey = stores === 'all' ? 'all' : stores.join(',')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fnRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
        setStale(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  useEffect(() => {
    const wanted = stores === 'all' ? null : new Set(stores)
    return subscribe((e) => {
      if (wanted && !e.stores.some((s) => wanted.has(s))) return
      if (e.origin === 'remote') setStale(true)
      setTick((t) => t + 1)
    })
  }, [storesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload, stale }
}
