import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord, withIdempotency } from '../repo'
import type { Attendance, Membership } from '@/domain/types'
import { isMembershipCurrent } from '@/domain/membership'
import { DomainError } from '../errors'
import { nowIso } from '@/domain/ids'

export async function listAttendance(): Promise<Attendance[]> {
  return readTx(['attendance'], (tx) => tx.objectStore('attendance').getAll())
}

export async function listAttendanceForMember(memberId: string): Promise<Attendance[]> {
  return readTx(['attendance'], (tx) => tx.objectStore('attendance').index('memberId').getAll(memberId))
}

export interface CheckInInput {
  memberId: string
  today: string
  /** Required when no current membership exists; staff must give a reason. */
  overrideReason?: string
  note?: string
  requestKey?: string
}

export class MembershipRequiredError extends DomainError {
  constructor(message: string) {
    super('membership-required', message)
  }
}

export async function checkIn(input: CheckInInput): Promise<Attendance> {
  return withIdempotency(input.requestKey, () =>
    writeTx(['members', 'memberships', 'attendance', 'activity'], async (tx) => {
      const member = await tx.objectStore('members').get(input.memberId)
      if (!member) throw new DomainError('member-missing', 'Member not found.')
      if (member.status === 'archived') throw new DomainError('member-archived', 'This member is archived. Restore them before checking in.')
      const open = (await tx.objectStore('attendance').index('memberId').getAll(member.id)).find((a) => a.checkOutAt === null)
      if (open) throw new DomainError('already-checked-in', `${member.name} is already checked in. Check them out first.`)
      const memberships: Membership[] = await tx.objectStore('memberships').index('memberId').getAll(member.id)
      const hasCurrent = memberships.some((m) => isMembershipCurrent(m, input.today))
      if (!hasCurrent && !input.overrideReason?.trim()) {
        throw new MembershipRequiredError(`${member.name} has no active membership today. Renew first, or allow entry with a reason.`)
      }
      const record = stampNew('att', {
        memberId: member.id,
        checkInAt: nowIso(),
        checkOutAt: null,
        source: 'manual' as const,
        note: input.note,
        overrideReason: hasCurrent ? undefined : input.overrideReason?.trim(),
      }) as Attendance
      await tx.objectStore('attendance').put(record)
      await logActivity(tx, {
        kind: 'attendance',
        message: `${member.name} checked in${record.overrideReason ? ` (override: ${record.overrideReason})` : ''}`,
        memberId: member.id,
        refType: 'attendance',
        refId: record.id,
      })
      return record
    }),
  )
}

export async function checkOut(id: string, expectedRev: number): Promise<Attendance> {
  return writeTx(['attendance', 'members', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'attendance', id, expectedRev, (a) => {
      if (a.checkOutAt) throw new DomainError('already-out', 'This visit is already checked out.')
      return { ...a, checkOutAt: nowIso() }
    })
    const member = await tx.objectStore('members').get(next.memberId)
    await logActivity(tx, { kind: 'attendance', message: `${member?.name ?? 'Member'} checked out`, memberId: next.memberId, refType: 'attendance', refId: id })
    return next
  })
}

export async function deleteAttendance(id: string): Promise<void> {
  return writeTx(['attendance', 'members', 'activity'], async (tx) => {
    const rec = await tx.objectStore('attendance').get(id)
    if (!rec) return
    await tx.objectStore('attendance').delete(id)
    const member = await tx.objectStore('members').get(rec.memberId)
    await logActivity(tx, { kind: 'attendance', message: `Removed a visit record for ${member?.name ?? 'member'}`, memberId: rec.memberId })
  })
}
