import { exportBackup, importBackup, validateBackup, BACKUP_FORMAT, BACKUP_VERSION, type Backup, type ImportPreview } from '../backup'
import { DriveError, type DriveAccount, type DriveClient, type DriveFile } from './driveApi'
import { md5Hex, sha256Hex } from './md5'
import { canGzip, gunzip, gzip, isGzip, sameBytes } from './gzip'
import { loadLink, saveLink, type DriveLink } from './driveState'
import { dataRevision } from '../events'

/**
 * Backup and restore rules for Google Drive.
 *
 * - One file per Google account, replaced in place. Older versions are not kept.
 * - Nothing is uploaded when the data has not changed.
 * - A backup is reported as done only after Drive's size and checksum match what was sent.
 * - The file is gzip-compressed where the browser can do it, and only after the compressed copy has
 *   been opened again and found identical. Plain JSON backups from before are still read.
 * - This device's data is never uploaded over a backup it does not belong to without the person saying so.
 * - A restore validates the file first, saves a copy of the current data, replaces everything in one
 *   transaction, then reads the result back and compares it with the backup.
 */

export const BACKUP_FILE_NAME = 'gymbook-backup.json'

export interface LocalSnapshot {
  backup: Backup
  bytes: Uint8Array
  /** Fingerprint of the records only, so the export time does not make identical data look new. */
  hash: string
  members: number
  /** Nothing a gym would miss: no members, plans, invoices, payments or visits. */
  empty: boolean
}

export async function takeSnapshot(): Promise<LocalSnapshot> {
  const backup = await exportBackup()
  const d = backup.data
  return {
    backup,
    bytes: new TextEncoder().encode(JSON.stringify(backup)),
    hash: await sha256Hex(JSON.stringify(d)),
    members: d.members.length,
    empty: d.members.length + d.plans.length + d.invoices.length + d.payments.length + d.attendance.length === 0,
  }
}

export interface UploadPayload {
  bytes: Uint8Array
  encoding: 'gzip' | 'identity'
  contentType: string
}

/**
 * What is actually sent to Drive. The compressed copy is used only if opening it again gives back
 * exactly the bytes that went in; otherwise the plain JSON is sent, which is always readable.
 */
export async function encodeForUpload(json: Uint8Array): Promise<UploadPayload> {
  const plain: UploadPayload = { bytes: json, encoding: 'identity', contentType: 'application/json' }
  if (!canGzip()) return plain
  try {
    const packed = await gzip(json)
    if (!isGzip(packed) || !sameBytes(await gunzip(packed), json)) return plain
    return { bytes: packed, encoding: 'gzip', contentType: 'application/gzip' }
  } catch {
    return plain
  }
}

/** Turn a downloaded backup file into text, whether it was stored compressed or not. Rejects if it is damaged gzip. */
export async function decodeBackupBytes(bytes: Uint8Array): Promise<string> {
  const raw = isGzip(bytes) ? await gunzip(bytes) : bytes
  return new TextDecoder().decode(raw)
}

/** The newest backup file in this account's app folder, if any. */
export async function findRemoteBackup(client: DriveClient, link: DriveLink | null): Promise<DriveFile | null> {
  if (link?.fileId) {
    const known = await client.get(link.fileId)
    if (known) return known
  }
  return (await client.list(BACKUP_FILE_NAME))[0] ?? null
}

export type SignInSituation =
  /** This device already backs up to this account and nothing else changed the backup. */
  | { kind: 'ready'; remote: DriveFile | null }
  /** Nothing in Drive yet and this device is not tied to another account: a first backup can be made. */
  | { kind: 'first-backup' }
  /** Drive has a backup and this device's data was never tied to this account: offer restore, never assume it. */
  | { kind: 'restore-offer'; remote: DriveFile; localEmpty: boolean }
  /** The data here belongs to a different Google account. */
  | { kind: 'other-account'; linkedEmail: string; remote: DriveFile | null }
  /** Another device replaced the backup since this one last backed up. */
  | { kind: 'remote-changed'; remote: DriveFile }

/** What signing in means for the data on this device. Deciding is separate from doing: nothing here uploads or restores. */
export function assessSignIn(link: DriveLink | null, account: DriveAccount, remote: DriveFile | null, localEmpty: boolean): SignInSituation {
  if (link && link.accountId !== account.id) return { kind: 'other-account', linkedEmail: link.email, remote }
  if (!link) return remote ? { kind: 'restore-offer', remote, localEmpty } : { kind: 'first-backup' }
  if (remote && link.lastBackupHash && remote.appProperties.contentHash && remote.appProperties.contentHash !== link.lastBackupHash) return { kind: 'remote-changed', remote }
  return { kind: 'ready', remote }
}

export type BlockReason =
  /** The data here was backed up to another Google account. */
  | 'other-account'
  /** This account already has a backup that this device's data did not come from. */
  | 'remote-exists'
  /** Another device replaced the backup since this one last backed up. */
  | 'remote-changed'
  /** This device has far fewer members than the backup it would replace. */
  | 'shrink'

/** A backup that was stopped because going ahead could destroy data. The person can allow it explicitly. */
export class BackupBlocked extends Error {
  reason: BlockReason
  remote: DriveFile | null
  localMembers: number
  constructor(reason: BlockReason, remote: DriveFile | null, localMembers: number, message: string) {
    super(message)
    this.name = 'BackupBlocked'
    this.reason = reason
    this.remote = remote
    this.localMembers = localMembers
  }
}

export interface BackupOptions {
  /**
   * The person has confirmed that this device's data should replace whatever the signed-in account
   * holds. Lifts every block. Automatic backups never pass it.
   */
  replace?: boolean
}

export type BackupOutcome = { status: 'uploaded'; file: DriveFile; created: boolean } | { status: 'unchanged'; file: DriveFile }

export const remoteMembers = (file: DriveFile | null): number | undefined => {
  const n = Number(file?.appProperties.members)
  return file && Number.isFinite(n) ? n : undefined
}

export async function runBackup(client: DriveClient, account: DriveAccount, options: BackupOptions = {}): Promise<BackupOutcome> {
  const link = loadLink()
  const sameAccount = link?.accountId === account.id
  // Read before the data: a change that lands while the backup runs then still counts as not backed up.
  const revision = dataRevision()
  const snapshot = await takeSnapshot()
  // A file id remembered for another account means nothing here.
  const remote = await findRemoteBackup(client, sameAccount ? link : null)

  if (!options.replace) {
    if (link && !sameAccount) throw new BackupBlocked('other-account', remote, snapshot.members, `The data on this device was backed up to ${link.email}. It was not uploaded to ${account.email}.`)
    if (!link && remote && remote.appProperties.contentHash !== snapshot.hash) throw new BackupBlocked('remote-exists', remote, snapshot.members, `${account.email} already has a GymBook backup that this device’s data did not come from. Nothing was uploaded.`)
    if (link && remote && link.lastBackupHash && remote.appProperties.contentHash && remote.appProperties.contentHash !== link.lastBackupHash && remote.appProperties.contentHash !== snapshot.hash) {
      throw new BackupBlocked('remote-changed', remote, snapshot.members, 'Another device has replaced the backup since this device last backed up. Nothing was uploaded.')
    }
    const before = remoteMembers(remote)
    if (before !== undefined && before > 0 && snapshot.members < before / 2) {
      throw new BackupBlocked('shrink', remote, snapshot.members, `This device has ${snapshot.members} member${snapshot.members === 1 ? '' : 's'} but the backup in Google Drive has ${before}. Nothing was uploaded.`)
    }
  }

  const linked = (file: DriveFile, uploaded: boolean): DriveLink => ({
    accountId: account.id,
    email: account.email,
    fileId: file.id,
    lastBackupAt: uploaded || !sameAccount ? file.modifiedTime : (link?.lastBackupAt ?? file.modifiedTime),
    lastBackupHash: snapshot.hash,
    lastBackupRev: revision,
    lastBackupSize: file.size,
    lastBackupMembers: snapshot.members,
    lastCheckedAt: new Date().toISOString(),
    auto: link?.auto ?? true,
  })

  if (remote && remote.appProperties.contentHash === snapshot.hash) {
    saveLink(linked(remote, false))
    return { status: 'unchanged', file: remote }
  }

  const payload = await encodeForUpload(snapshot.bytes)
  const file = await client.upload({
    name: BACKUP_FILE_NAME,
    bytes: payload.bytes,
    contentType: payload.contentType,
    existingId: remote?.id,
    appProperties: {
      format: BACKUP_FORMAT,
      formatVersion: String(BACKUP_VERSION),
      encoding: payload.encoding,
      contentHash: snapshot.hash,
      exportedAt: snapshot.backup.exportedAt,
      members: String(snapshot.members),
      gymName: (snapshot.backup.data.settings?.gymName ?? '').slice(0, 60),
    },
  })

  // Trust Drive's own account of what it stored, not the fact that the request did not fail.
  const expected = md5Hex(payload.bytes)
  if (file.size !== payload.bytes.length || (file.md5Checksum !== undefined && file.md5Checksum !== expected)) {
    throw new DriveError('verify', 'Google Drive stored something different from what was sent, so this backup cannot be trusted. Try again.')
  }
  if (file.md5Checksum === undefined) {
    const check = await client.get(file.id)
    if (!check || check.size !== payload.bytes.length || check.md5Checksum !== expected) throw new DriveError('verify', 'The backup could not be confirmed in Google Drive. Try again.')
  }

  saveLink(linked(file, true))
  return { status: 'uploaded', file, created: !remote }
}

export interface RemotePreview {
  file: DriveFile
  preview: ImportPreview
}

/** Download the account's backup and check it. Never touches the data on this device. */
export async function loadRemoteBackup(client: DriveClient, file: DriveFile): Promise<RemotePreview> {
  const bytes = await client.download(file.id)
  let text: string
  try {
    text = await decodeBackupBytes(bytes)
  } catch {
    return { file, preview: { ok: false, errors: ['The backup file in Google Drive is damaged and could not be opened.'], warnings: [], counts: {} } }
  }
  return { file, preview: validateBackup(text) }
}

export interface RestoreResult {
  /** A copy of the data that was on this device was handed to `saveCopy` before anything was replaced. */
  safetyCopySaved: boolean
  /** Stores whose contents, read back after the restore, differ from the backup. Empty when the restore is verified. */
  mismatches: string[]
}

const VERIFIED_STORES = ['members', 'plans', 'memberships', 'invoices', 'adjustments', 'payments', 'attendance', 'followups', 'workouts', 'trainers', 'schedules', 'expenses', 'sessions', 'equipment', 'incidents'] as const

const canonical = (rows: { id: string }[]) => JSON.stringify([...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))

/**
 * Replace this device's data with a validated backup from Drive.
 * `saveCopy` receives the current data first (unless there is none), so a wrong restore can be undone from that file.
 */
export async function restoreFromDrive(account: DriveAccount, remote: RemotePreview, saveCopy: (filename: string, json: string) => void): Promise<RestoreResult> {
  const backup = remote.preview.backup
  if (!remote.preview.ok || !backup) throw new DriveError('verify', 'This backup did not pass its checks, so nothing was restored.')

  const current = await takeSnapshot()
  let safetyCopySaved = false
  if (!current.empty) {
    saveCopy(`gymbook-before-restore-${current.backup.exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`, JSON.stringify(current.backup, null, 2))
    safetyCopySaved = true
  }

  // One transaction: either every store is replaced or none is.
  await importBackup(backup)

  const after = (await exportBackup()).data
  const mismatches: string[] = []
  const workoutIds = new Set(backup.data.workouts.map((w) => w.id))
  for (const store of VERIFIED_STORES) {
    // The import clears a member's link to a workout plan the backup does not contain; mirror that before comparing.
    const expected = store === 'members' ? backup.data.members.map((m) => (m.workoutPlanId && !workoutIds.has(m.workoutPlanId) ? { ...m, workoutPlanId: undefined } : m)) : backup.data[store]
    if (canonical(expected as { id: string }[]) !== canonical(after[store] as { id: string }[])) mismatches.push(store)
  }

  const previous = loadLink()
  saveLink({
    accountId: account.id,
    email: account.email,
    fileId: remote.file.id,
    lastBackupAt: remote.file.modifiedTime,
    // The backup this device now matches, so the next comparison with Drive does not look like a conflict.
    lastBackupHash: remote.file.appProperties.contentHash,
    // Only a restore that was read back and matches counts as "nothing changed since".
    lastBackupRev: mismatches.length === 0 ? dataRevision() : undefined,
    lastBackupSize: remote.file.size,
    lastBackupMembers: backup.data.members.length,
    lastCheckedAt: new Date().toISOString(),
    auto: previous?.accountId === account.id ? previous.auto : true,
  })
  return { safetyCopySaved, mismatches }
}

/**
 * Whether the data changed since the last backup, answered from the revision counter when the link
 * has one. `undefined` means only a comparison of the data itself can tell (a link saved before
 * the counter existed).
 */
export function changedSinceBackup(link: DriveLink | null): boolean | undefined {
  if (!link?.lastBackupHash) return Boolean(link)
  if (link.lastBackupRev === undefined) return undefined
  return dataRevision() !== link.lastBackupRev
}

/** Automatic backup is due when the data changed and the last successful backup is at least a day old. */
export function isBackupOverdue(link: DriveLink | null, changed: boolean, now: Date = new Date()): boolean {
  if (!link || !link.auto || !changed) return false
  if (!link.lastBackupAt) return true
  return now.getTime() - new Date(link.lastBackupAt).getTime() >= 24 * 60 * 60 * 1000
}
