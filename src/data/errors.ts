export type StorageErrorKind = 'unavailable' | 'quota' | 'conflict' | 'not-found' | 'validation' | 'blocked' | 'simulated' | 'unknown'

export class StorageError extends Error {
  kind: StorageErrorKind
  constructor(kind: StorageErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StorageError'
    this.kind = kind
  }
}

export class DomainError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

/** Convert any thrown value from IndexedDB into a StorageError with a human message. */
export function toStorageError(err: unknown): StorageError {
  if (err instanceof StorageError || err instanceof DomainError) return err as StorageError
  const name = (err as { name?: string })?.name ?? ''
  const msg = (err as { message?: string })?.message ?? String(err)
  if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
    return new StorageError('quota', 'Browser storage is full. Free up space or export a backup, then try again.', { cause: err })
  }
  if (name === 'InvalidStateError' || name === 'SecurityError' || /indexeddb|database/i.test(msg)) {
    return new StorageError('unavailable', 'Browser storage is unavailable. Private browsing or storage settings may be blocking it.', { cause: err })
  }
  if (name === 'ConstraintError' || /uniqueness/i.test(msg)) {
    return new StorageError('conflict', 'A record with the same unique value (such as an invoice number) already exists. Nothing was saved.', { cause: err })
  }
  if (name === 'VersionError' || name === 'AbortError') {
    return new StorageError('blocked', 'The database could not be opened. Close other GymBook tabs and reload.', { cause: err })
  }
  return new StorageError('unknown', msg || 'Something went wrong while saving.', { cause: err })
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
