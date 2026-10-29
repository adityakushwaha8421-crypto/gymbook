import { readTx } from './db'
import type { Adjustment, Attendance, Equipment, Expense, FollowUp, Incident, Invoice, Member, Membership, Payment, Plan, Session, Trainer, TrainerSchedule, WorkoutPlan } from '@/domain/types'

export interface Snapshot {
  members: Member[]
  plans: Plan[]
  memberships: Membership[]
  invoices: Invoice[]
  adjustments: Adjustment[]
  payments: Payment[]
  attendance: Attendance[]
  trainers: Trainer[]
  schedules: TrainerSchedule[]
  expenses: Expense[]
  followups: FollowUp[]
  sessions: Session[]
  equipment: Equipment[]
  incidents: Incident[]
  workouts: WorkoutPlan[]
}

export const SNAPSHOT_STORES = ['members', 'plans', 'memberships', 'invoices', 'adjustments', 'payments', 'attendance', 'trainers', 'schedules', 'expenses', 'followups', 'sessions', 'equipment', 'incidents', 'workouts'] as const

/** Load every business store in one read transaction for derived views. */
export async function loadSnapshot(): Promise<Snapshot> {
  return readTx([...SNAPSHOT_STORES], async (tx) => ({
    members: await tx.objectStore('members').getAll(),
    plans: await tx.objectStore('plans').getAll(),
    memberships: await tx.objectStore('memberships').getAll(),
    invoices: await tx.objectStore('invoices').getAll(),
    adjustments: await tx.objectStore('adjustments').getAll(),
    payments: await tx.objectStore('payments').getAll(),
    attendance: await tx.objectStore('attendance').getAll(),
    trainers: await tx.objectStore('trainers').getAll(),
    schedules: await tx.objectStore('schedules').getAll(),
    expenses: await tx.objectStore('expenses').getAll(),
    followups: await tx.objectStore('followups').getAll(),
    sessions: await tx.objectStore('sessions').getAll(),
    equipment: await tx.objectStore('equipment').getAll(),
    incidents: await tx.objectStore('incidents').getAll(),
    workouts: await tx.objectStore('workouts').getAll(),
  }))
}

export function indexBy<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]))
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
