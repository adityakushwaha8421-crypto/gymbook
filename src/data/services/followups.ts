import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord } from '../repo'
import type { FollowUp } from '@/domain/types'
import type { FollowUpFormValues } from '@/domain/validation'
import { nowIso } from '@/domain/ids'
import { isISODate } from '@/domain/dates'
import { DomainError } from '../errors'

export async function listFollowUps(): Promise<FollowUp[]> {
  return readTx(['followups'], (tx) => tx.objectStore('followups').getAll())
}

export async function createFollowUp(values: FollowUpFormValues): Promise<FollowUp> {
  return writeTx(['followups', 'activity'], async (tx) => {
    const f = stampNew('fu', { ...values, status: 'open' as const }) as FollowUp
    await tx.objectStore('followups').put(f)
    await logActivity(tx, { kind: 'followup', message: `Added follow-up: ${values.note || values.type}`, memberId: values.memberId, refType: 'followup', refId: f.id })
    return f
  })
}

export async function updateFollowUp(id: string, expectedRev: number, values: FollowUpFormValues): Promise<FollowUp> {
  return writeTx(['followups', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'followups', id, expectedRev, (f) => ({ ...f, ...values }))
    await logActivity(tx, { kind: 'followup', message: `Updated follow-up: ${next.note || next.type}`, memberId: next.memberId, refType: 'followup', refId: id })
    return next
  })
}

export async function setFollowUpStatus(id: string, expectedRev: number, status: 'open' | 'done'): Promise<FollowUp> {
  return writeTx(['followups', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'followups', id, expectedRev, (f) => ({ ...f, status, completedAt: status === 'done' ? nowIso() : undefined }))
    await logActivity(tx, { kind: 'followup', message: `${status === 'done' ? 'Completed' : 'Reopened'} follow-up: ${next.note || next.type}`, memberId: next.memberId, refType: 'followup', refId: id })
    return next
  })
}

export async function rescheduleFollowUp(id: string, expectedRev: number, dueDate: string): Promise<FollowUp> {
  if (!isISODate(dueDate)) throw new DomainError('due-date', 'Enter a valid due date.')
  return writeTx(['followups', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'followups', id, expectedRev, (f) => ({ ...f, dueDate, status: 'open', completedAt: undefined }))
    await logActivity(tx, { kind: 'followup', message: `Rescheduled follow-up to ${dueDate}: ${next.note || next.type}`, memberId: next.memberId, refType: 'followup', refId: id })
    return next
  })
}

export async function deleteFollowUp(id: string): Promise<void> {
  return writeTx(['followups'], async (tx) => {
    await tx.objectStore('followups').delete(id)
  })
}
