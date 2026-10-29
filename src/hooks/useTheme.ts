import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
const KEY = 'gymbook-theme'

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0c0f' : '#f4f5f7')
}

/** Theme preference persisted per browser; 'system' follows prefers-color-scheme. */
export function useTheme(): { preference: ThemePreference; resolved: 'light' | 'dark'; setPreference: (p: ThemePreference) => void; toggle: () => void } {
  const [preference, setPref] = useState<ThemePreference>(read)
  const [systemDark, setSystemDark] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false))

  useEffect(() => {
    applyTheme(read())
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      setSystemDark(mql.matches)
      applyTheme(read())
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p)
    try {
      if (p === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, p)
    } catch {
      // storage unavailable: theme still applies for this session
    }
    applyTheme(p)
  }, [])

  const resolved: 'light' | 'dark' = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  const toggle = useCallback(() => setPreference(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPreference])
  return { preference, resolved, setPreference, toggle }
}
