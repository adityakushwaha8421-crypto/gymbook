import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const PAGE_ACTIONS_ID = 'page-header-actions'

/** Renders its children into the page header's action slot (drawn by the shell). */
export function PageActions({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setTarget(document.getElementById(PAGE_ACTIONS_ID))
  }, [])
  if (!target) return null
  return createPortal(children, target)
}
