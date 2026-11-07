import { readTx } from './db'
import type { Adjustment, Attendance, FollowUp, Invoice, Member, Membership, Payment, Plan, WorkoutPlan } from '@/domain/types'

export interface Snapshot {
  members: Member[]
  plans: Plan[]
  memberships: Membership[]
  invoices: Invoice[]
  adjustments: Adjustment[]
  payments: Payment[]
  attendance: Attendance[]
  followups: FollowUp[]
  workouts: WorkoutPlan[]
}

export const SNAPSHOT_STORES = ['members', 'plans', 'memberships', 'invoices', 'adjustments', 'payments', 'attendance', 'followups', 'workouts'] as const
/** The stores a page depends on when it does not read visits. */
export const SNAPSHOT_STORES_WITHOUT_VISITS = SNAPSHOT_STORES.filter((s) => s !== 'attendance')

export interface SnapshotOptions {
  /**
   * Which visits to read. Visits are by far the largest store (one row per check-in, for ever), and
   * reading all of them took seconds on a large gym, so a page that does not show visits leaves
   * them out, and a member's own page reads only that member's.
   */
  attendance?: 'all' | 'none' | { memberId: string }
}

/** Load every store the app's views are derived from, in one read transaction. */
export async function loadSnapshot(options: SnapshotOptions = {}): Promise<Snapshot> {
  const visits = options.attendance ?? 'all'
  return readTx([...SNAPSHOT_STORES], async (tx) => ({
    members: await tx.objectStore('members').getAll(),
    plans: await tx.objectStore('plans').getAll(),
    memberships: await tx.objectStore('memberships').getAll(),
    invoices: await tx.objectStore('invoices').getAll(),
    adjustments: await tx.objectStore('adjustments').getAll(),
    payments: await tx.objectStore('payments').getAll(),
    attendance: visits === 'none' ? [] : visits === 'all' ? await tx.objectStore('attendance').getAll() : await tx.objectStore('attendance').index('memberId').getAll(visits.memberId),
    followups: await tx.objectStore('followups').getAll(),
    workouts: await tx.objectStore('workouts').getAll(),
  }))
}

/** For pages that never show visits or "last visit": everything except the attendance store. */
export function loadSnapshotWithoutVisits(): Promise<Snapshot> {
  return loadSnapshot({ attendance: 'none' })
}

export function groupBy<T>(list: T[], key: (x: T) => string | undefined): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const x of list) {
    const k = key(x)
    if (k === undefined) continue
    const arr = out.get(k)
    if (arr) arr.push(x)
    else out.set(k, [x])
  }
  return out
}
