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

/** Load every store the app's views are derived from, in one read transaction. */
export async function loadSnapshot(): Promise<Snapshot> {
  return readTx([...SNAPSHOT_STORES], async (tx) => ({
    members: await tx.objectStore('members').getAll(),
    plans: await tx.objectStore('plans').getAll(),
    memberships: await tx.objectStore('memberships').getAll(),
    invoices: await tx.objectStore('invoices').getAll(),
    adjustments: await tx.objectStore('adjustments').getAll(),
    payments: await tx.objectStore('payments').getAll(),
    attendance: await tx.objectStore('attendance').getAll(),
    followups: await tx.objectStore('followups').getAll(),
    workouts: await tx.objectStore('workouts').getAll(),
  }))
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
