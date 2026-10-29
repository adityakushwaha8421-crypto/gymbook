import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord } from '../repo'
import type { Trainer, TrainerSchedule } from '@/domain/types'
import type { TrainerFormValues, ScheduleFormValues } from '@/domain/validation'
import { toMinutes } from '@/domain/validation'
import { DomainError } from '../errors'
import { nowIso } from '@/domain/ids'
import { WEEKDAYS, formatMinutes } from '@/domain/dates'

export async function listTrainers(): Promise<Trainer[]> {
  return readTx(['trainers'], (tx) => tx.objectStore('trainers').getAll())
}
export async function listSchedules(): Promise<TrainerSchedule[]> {
  return readTx(['schedules'], (tx) => tx.objectStore('schedules').getAll())
}

export async function createTrainer(values: TrainerFormValues): Promise<Trainer> {
  return writeTx(['trainers', 'activity'], async (tx) => {
    const t = stampNew('tr', { ...values, status: 'active' as const }) as Trainer
    await tx.objectStore('trainers').put(t)
    await logActivity(tx, { kind: 'trainer', message: `Added trainer ${t.name}`, refType: 'trainer', refId: t.id })
    return t
  })
}

export async function updateTrainer(id: string, expectedRev: number, values: TrainerFormValues): Promise<Trainer> {
  return writeTx(['trainers', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'trainers', id, expectedRev, (t) => ({ ...t, ...values }))
    await logActivity(tx, { kind: 'trainer', message: `Updated trainer ${next.name}`, refType: 'trainer', refId: id })
    return next
  })
}

export async function setTrainerArchived(id: string, expectedRev: number, archived: boolean): Promise<Trainer> {
  return writeTx(['trainers', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'trainers', id, expectedRev, (t) => ({
      ...t,
      status: archived ? 'archived' : 'active',
      archivedAt: archived ? nowIso() : undefined,
    }))
    await logActivity(tx, { kind: 'trainer', message: `${archived ? 'Archived' : 'Restored'} trainer ${next.name}`, refType: 'trainer', refId: id })
    return next
  })
}

export function findScheduleOverlap(existing: TrainerSchedule[], candidate: { weekday: number; startMinutes: number; endMinutes: number }, excludeId?: string): TrainerSchedule | undefined {
  return existing.find(
    (s) => s.id !== excludeId && s.weekday === candidate.weekday && s.startMinutes < candidate.endMinutes && candidate.startMinutes < s.endMinutes,
  )
}

export async function saveSchedule(trainerId: string, values: ScheduleFormValues, existingId?: string, expectedRev?: number): Promise<TrainerSchedule> {
  return writeTx(['schedules', 'trainers', 'activity'], async (tx) => {
    const trainer = await tx.objectStore('trainers').get(trainerId)
    if (!trainer) throw new DomainError('trainer-missing', 'Trainer not found.')
    const all = await tx.objectStore('schedules').index('trainerId').getAll(trainerId)
    const candidate = { weekday: values.weekday, startMinutes: toMinutes(values.startTime), endMinutes: toMinutes(values.endTime) }
    const clash = findScheduleOverlap(all, candidate, existingId)
    if (clash) {
      throw new DomainError(
        'overlap',
        `Overlaps "${clash.label}" on ${WEEKDAYS[clash.weekday]} (${formatMinutes(clash.startMinutes)}–${formatMinutes(clash.endMinutes)}).`,
      )
    }
    let record: TrainerSchedule
    if (existingId) {
      record = await updateRecord(tx, 'schedules', existingId, expectedRev, (s) => ({ ...s, ...candidate, label: values.label }))
    } else {
      record = stampNew('sch', { trainerId, ...candidate, label: values.label }) as TrainerSchedule
      await tx.objectStore('schedules').put(record)
    }
    await logActivity(tx, { kind: 'trainer', message: `${existingId ? 'Updated' : 'Added'} schedule "${values.label}" for ${trainer.name}`, refType: 'trainer', refId: trainerId })
    return record
  })
}

export async function deleteSchedule(id: string): Promise<void> {
  return writeTx(['schedules'], async (tx) => {
    await tx.objectStore('schedules').delete(id)
  })
}
