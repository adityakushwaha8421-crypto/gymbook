import { createContext } from 'react'
import type { Settings } from '@/domain/types'

export interface AppState {
  settings: Settings
  today: string
  timezone: string
  refreshSettings: () => Promise<void>
}

/** Kept in a module without components so hot reloading never recreates it. */
export const AppCtx = createContext<AppState | null>(null)

export interface PageMeta {
  title: string
  description?: string
  /** When false the page draws its own header (detail pages). */
  header?: boolean
}
export interface HeaderState {
  meta: PageMeta
  setMeta: (m: PageMeta) => void
}
export const HeaderContext = createContext<HeaderState>({ meta: { title: '' }, setMeta: () => {} })
