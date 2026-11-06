/**
 * Testing aid: when armed, the next write transaction throws a simulated
 * storage failure before committing. Used to verify that the UI reports
 * failures honestly and preserves form input. Never armed in normal use.
 */
let armed = false

/** Session flag end-to-end tests set to arm the failure. Read in development builds only. */
export const FAIL_NEXT_SAVE_KEY = 'gymbook-fail-next-save'

export function armSaveFailure(): void {
  armed = true
}

export function consumeSaveFailure(): boolean {
  let was = armed
  armed = false
  if (import.meta.env.DEV) {
    try {
      if (sessionStorage.getItem(FAIL_NEXT_SAVE_KEY)) {
        sessionStorage.removeItem(FAIL_NEXT_SAVE_KEY)
        was = true
      }
    } catch {
      // Storage unavailable: nothing to consume.
    }
  }
  return was
}
