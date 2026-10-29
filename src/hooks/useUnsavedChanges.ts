import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Warn before leaving a page with unsaved edits: blocks in-app navigation
 * (returns the blocker for a confirm dialog) and prompts on tab close.
 * `allowLeave()` clears the guard synchronously, for use right before a
 * post-save redirect, since React state would update too late.
 */
export function useUnsavedChanges(dirty: boolean) {
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  const allowLeave = useCallback(() => {
    dirtyRef.current = false
  }, [])
  return { blocker, allowLeave }
}
