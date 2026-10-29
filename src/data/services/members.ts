import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord, withIdempotency } from '../repo'
import type { Member } from '@/domain/types'
import type { MemberFormValues } from '@/domain/validation'
import { normalizePhone } from '@/domain/validation'
import { nowIso } from '@/domain/ids'
import { DomainError } from '../errors'

export async function listMembers(): Promise<Member[]> {
  return readTx(['members'], (tx) => tx.objectStore('members').getAll())
}

export async function getMember(id: string): Promise<Member | undefined> {
  return readTx(['members'], (tx) => tx.objectStore('members').get(id))
}

/** Members sharing a normalised phone or exact email; informational, never blocking. */
export function findPossibleDuplicates(all: Member[], values: { phone: string; email?: string; name?: string }, excludeId?: string): Member[] {
  const phone = normalizePhone(values.phone)
  const email = values.email?.toLowerCase()
  const name = values.name?.trim().toLowerCase()
  return all.filter((m) => {
    if (m.id === excludeId) return false
    if (m.status === 'archived' && !phone) return false
    if (phone && normalizePhone(m.phone) === phone) return true
    if (email && m.email?.toLowerCase() === email) return true
    if (name && name.length > 3 && m.name.trim().toLowerCase() === name) return true
    return false
  })
}

export async function createMember(values: MemberFormValues, opts: { requestKey?: string } = {}): Promise<Member> {
  return withIdempotency(opts.requestKey, () =>
    writeTx(['members', 'counters', 'activity'], async (tx) => {
      const counters = tx.objectStore('counters')
      const next = ((await counters.get('member'))?.value ?? 0) + 1
      await counters.put({ key: 'member', value: next })
      const member = stampNew<Omit<Member, keyof import('@/domain/types').BaseRecord>>('mem', {
        name: values.name,
        phone: values.phone,
        email: values.email,
        joiningDate: values.joiningDate,
        status: 'active',
        notes: values.notes,
        photoDataUrl: values.photoDataUrl,
        trainerId: values.trainerId,
        memberCode: `GB-${String(next).padStart(4, '0')}`,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        emergencyName: values.emergencyName,
        emergencyPhone: values.emergencyPhone,
        goal: values.goal,
        healthNotes: values.healthNotes,
      })
      await tx.objectStore('members').put(member)
      await logActivity(tx, { kind: 'member', message: `Added member ${member.name}`, memberId: member.id, refType: 'member', refId: member.id })
      return member
    }),
  )
}

export async function updateMember(id: string, expectedRev: number, values: MemberFormValues): Promise<Member> {
  return writeTx(['members', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'members', id, expectedRev, (m) => ({
      ...m,
      name: values.name,
      phone: values.phone,
      email: values.email,
      joiningDate: values.joiningDate,
      notes: values.notes,
      photoDataUrl: values.photoDataUrl,
      trainerId: values.trainerId,
      dateOfBirth: values.dateOfBirth,
      gender: values.gender,
      emergencyName: values.emergencyName,
      emergencyPhone: values.emergencyPhone,
      goal: values.goal,
      healthNotes: values.healthNotes,
    }))
    await logActivity(tx, { kind: 'member', message: `Updated member ${next.name}`, memberId: id, refType: 'member', refId: id })
    return next
  })
}

export async function setMemberArchived(id: string, expectedRev: number, archived: boolean): Promise<Member> {
  return writeTx(['members', 'attendance', 'activity'], async (tx) => {
    if (archived) {
      const open = (await tx.objectStore('attendance').index('memberId').getAll(id)).some((a) => a.checkOutAt === null)
      if (open) throw new DomainError('open-checkin', 'This member is currently checked in. Check them out before archiving.')
    }
    const next = await updateRecord(tx, 'members', id, expectedRev, (m) => ({
      ...m,
      status: archived ? 'archived' : 'active',
      archivedAt: archived ? nowIso() : undefined,
    }))
    await logActivity(tx, {
      kind: 'member',
      message: archived ? `Archived member ${next.name}` : `Restored member ${next.name}`,
      memberId: id,
      refType: 'member',
      refId: id,
    })
    return next
  })
}
