/**
 * What this browser remembers about its Google Drive backup: which Google account the data here
 * belongs to, and what the last successful backup was.
 *
 * It lives in localStorage, not in the database, on purpose: it describes this device, so it must
 * not travel inside a backup, and it is cleared together with the data on "Reset everything".
 * No token or password is ever stored here.
 */
export interface DriveLink {
  /** Google account the data in this browser was last backed up to or restored from. */
  accountId: string
  email: string
  fileId?: string
  /** Time Google Drive recorded for the last backup this device made or restored. */
  lastBackupAt?: string
  /** Fingerprint of the data in that backup; unchanged data is not uploaded again. */
  lastBackupHash?: string
  /**
   * The data revision counter (see `dataRevision`) when that backup's copy of the data was read.
   * If the counter still shows this number, nothing has changed and the database need not be read to find out.
   */
  lastBackupRev?: number
  lastBackupSize?: number
  lastBackupMembers?: number
  /** Last time this device compared its data with Drive, whether or not anything was uploaded. */
  lastCheckedAt?: string
  /** Back up automatically while the app is open. */
  auto: boolean
}

const KEY = 'gymbook-drive-link'
const listeners = new Set<() => void>()
let cache: { raw: string | null; value: DriveLink | null } | null = null

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function loadLink(): DriveLink | null {
  const raw = read()
  if (cache && cache.raw === raw) return cache.value
  let value: DriveLink | null = null
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DriveLink>
      if (typeof parsed.accountId === 'string' && typeof parsed.email === 'string') value = { ...parsed, accountId: parsed.accountId, email: parsed.email, auto: parsed.auto !== false }
    } catch {
      value = null
    }
  }
  cache = { raw, value }
  return value
}

export function saveLink(link: DriveLink): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(link))
  } catch {
    // Storage blocked: the backup itself still happened; only the reminder of it is lost.
  }
  cache = null
  for (const l of listeners) l()
}

export function clearLink(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
  cache = null
  for (const l of listeners) l()
}

export function subscribeLink(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
