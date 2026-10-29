import { useRef } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { useBlocker } from 'react-router-dom'

/**
 * Confirms leaving a page when a form has unsaved edits. After "Discard" we
 * let the blocked navigation proceed and must NOT reset the blocker: for a
 * browser Back (POP) the navigation completes asynchronously, and a reset in
 * between re-blocks it, which trapped people on the edit page.
 */
export function DiscardGuard({ blocker }: { blocker: ReturnType<typeof useBlocker> }) {
  const proceeded = useRef(false)
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={() => {
        if (proceeded.current) {
          proceeded.current = false
          return
        }
        if (blocker.state === 'blocked') blocker.reset()
      }}
      title="Discard unsaved changes?"
      description="You have edits that haven’t been saved. Leaving now will throw them away."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      danger
      onConfirm={() => {
        if (blocker.state === 'blocked') {
          proceeded.current = true
          blocker.proceed()
        }
      }}
    />
  )
}
