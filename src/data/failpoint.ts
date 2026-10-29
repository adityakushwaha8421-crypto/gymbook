/**
 * Testing aid: when armed, the next write transaction throws a simulated
 * storage failure before committing. Used to verify that the UI reports
 * failures honestly and preserves form input. Never armed in normal use.
 */
let armed = false

export function armSaveFailure(): void {
  armed = true
}

export function isSaveFailureArmed(): boolean {
  return armed
}

export function consumeSaveFailure(): boolean {
  const was = armed
  armed = false
  return was
}
