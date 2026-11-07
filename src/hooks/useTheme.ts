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
  // The board is the default; only an explicit 'light' preference leaves it.
  const dark = pref !== 'light'
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c0e11' : '#eceff3')
}

/** Theme preference persisted per browser. 'system' (nothing stored) means the default dark board; 'light' is the one opt-out. */
export function useTheme(): { preference: ThemePreference; resolved: 'light' | 'dark'; setPreference: (p: ThemePreference) => void; toggle: () => void } {
  const [preference, setPref] = useState<ThemePreference>(read)
  useEffect(() => {
    applyTheme(read())
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

  const resolved: 'light' | 'dark' = preference === 'light' ? 'light' : 'dark'
  const toggle = useCallback(() => setPreference(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPreference])
  return { preference, resolved, setPreference, toggle }
}
