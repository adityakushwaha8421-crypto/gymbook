import type { IDBPTransaction, StoreNames } from 'idb'
import type { GymDB } from './db'
import { StorageError } from './errors'
import { newId, nowIso } from '@/domain/ids'
import type { Activity, ActivityKind, BaseRecord } from '@/domain/types'

type AnyWriteTx = IDBPTransaction<GymDB, StoreNames<GymDB>[], 'readwrite'>

/** Attach id, timestamps and rev 1 to a new record. */
export function stampNew<T extends object>(prefix: string, data: T, sample?: boolean): T & BaseRecord {
  const now = nowIso()
  return { ...data, id: newId(prefix), createdAt: now, updatedAt: now, rev: 1, ...(sample ? { sample: true } : {}) }
}

/**
 * Read-modify-write with optimistic concurrency. If the stored rev differs
 * from what the caller last saw, the write is refused so another tab's
 * change is not silently overwritten.
 */
export async function updateRecord<S extends 'members' | 'plans' | 'memberships' | 'invoices' | 'payments' | 'attendance' | 'trainers' | 'schedules' | 'expenses' | 'followups' | 'adjustments' | 'sessions' | 'equipment' | 'incidents' | 'workouts'>(
  tx: AnyWriteTx,
  store: S,
  id: string,
  expectedRev: number | undefined,
  mutate: (current: GymDB[S]['value']) => GymDB[S]['value'],
): Promise<GymDB[S]['value']> {
  const os = tx.objectStore(store)
  const current = (await os.get(id)) as GymDB[S]['value'] | undefined
  if (!current) throw new StorageError('not-found', 'This record no longer exists. It may have been deleted in another tab.')
  if (expectedRev !== undefined && current.rev !== expectedRev) {
    throw new StorageError('conflict', 'This record was changed in another tab since you opened it. Reload to see the latest version, then try again.')
  }
  const next = { ...mutate(current), updatedAt: nowIso(), rev: current.rev + 1 } as GymDB[S]['value']
  await (os as unknown as { put: (v: GymDB[S]['value']) => Promise<unknown> }).put(next)
  return next
}

export async function logActivity(
  tx: AnyWriteTx,
  entry: { kind: ActivityKind; message: string; memberId?: string; refType?: string; refId?: string },
): Promise<void> {
  const activity: Activity = { id: newId('act'), at: nowIso(), ...entry }
  await tx.objectStore('activity').put(activity)
}

/** Simple in-flight guard so a double-submitted form cannot write twice. */
const inFlight = new Map<string, Promise<unknown>>()
export function withIdempotency<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
  if (!key) return fn()
  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T>
  const p = fn().then(
    (result) => {
      // Keep a successful result briefly so a double submit returns the same record.
      setTimeout(() => inFlight.delete(key), 5000)
      return result
    },
    (err) => {
      // A failure must be retryable at once.
      inFlight.delete(key)
      throw err
    },
  )
  inFlight.set(key, p)
  return p
}
