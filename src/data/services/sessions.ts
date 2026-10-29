import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord, withIdempotency } from '../repo'
import type { Session, SessionStatus } from '@/domain/types'
import type { SessionFormValues } from '@/domain/validation'
import { DomainError } from '../errors'
import { nowIso } from '@/domain/ids'
import { formatDateTime } from '@/domain/dates'

export async function listSessions(): Promise<Session[]> {
  return readTx(['sessions'], (tx) => tx.objectStore('sessions').getAll())
}

export function sessionEnd(s: { startAt: string; durationMinutes: number }): string {
  return new Date(new Date(s.startAt).getTime() + s.durationMinutes * 60_000).toISOString()
}

function overlaps(a: { startAt: string; durationMinutes: number }, b: { startAt: string; durationMinutes: number }): boolean {
  return a.startAt < sessionEnd(b) && b.startAt < sessionEnd(a)
}

/** A scheduled session that clashes with the candidate for the same trainer or member. */
export function findSessionConflict(existing: Session[], candidate: { trainerId: string; memberId: string; startAt: string; durationMinutes: number }, excludeId?: string): { session: Session; who: 'trainer' | 'member' } | undefined {
  for (const s of existing) {
    if (s.id === excludeId || s.status !== 'scheduled') continue
    if (!overlaps(s, candidate)) continue
    if (s.trainerId === candidate.trainerId) return { session: s, who: 'trainer' }
    if (s.memberId === candidate.memberId) return { session: s, who: 'member' }
  }
  return undefined
}

export interface SaveSessionInput extends SessionFormValues {
  /** Instant derived from the local date-time in the gym timezone. */
  startAtInstant: string
}

export async function saveSession(input: SaveSessionInput, timezone: string, existingId?: string, expectedRev?: number, requestKey?: string): Promise<Session> {
  return withIdempotency(requestKey, () =>
    writeTx(['sessions', 'trainers', 'members', 'activity'], async (tx) => {
      const trainer = await tx.objectStore('trainers').get(input.trainerId)
      if (!trainer) throw new DomainError('trainer-missing', 'Trainer not found.')
      if (trainer.status === 'archived') throw new DomainError('trainer-archived', 'This trainer is archived.')
      const member = await tx.objectStore('members').get(input.memberId)
      if (!member) throw new DomainError('member-missing', 'Member not found.')
      if (member.status === 'archived') throw new DomainError('member-archived', 'This member is archived.')
      const all = await tx.objectStore('sessions').getAll()
      const candidate = { trainerId: input.trainerId, memberId: input.memberId, startAt: input.startAtInstant, durationMinutes: input.durationMinutes }
      const clash = findSessionConflict(all, candidate, existingId)
      if (clash) {
        const other = clash.who === 'trainer' ? trainer.name : member.name
        throw new DomainError('session-conflict', `${other} already has a session at ${formatDateTime(clash.session.startAt, timezone)} (${clash.session.durationMinutes} min).`)
      }
      let record: Session
      if (existingId) {
        record = await updateRecord(tx, 'sessions', existingId, expectedRev, (s) => ({ ...s, ...candidate, note: input.note }))
      } else {
        record = stampNew('ses', { ...candidate, status: 'scheduled' as const, note: input.note }) as Session
        await tx.objectStore('sessions').put(record)
      }
      await logActivity(tx, {
        kind: 'session',
        message: `${existingId ? 'Updated' : 'Booked'} PT session: ${member.name} with ${trainer.name} on ${formatDateTime(record.startAt, timezone)}`,
        memberId: member.id,
        refType: 'session',
        refId: record.id,
      })
      return record
    }),
  )
}

export async function setSessionStatus(id: string, expectedRev: number, status: SessionStatus): Promise<Session> {
  return writeTx(['sessions', 'members', 'trainers', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'sessions', id, expectedRev, (s) => ({ ...s, status, statusChangedAt: nowIso() }))
    const member = await tx.objectStore('members').get(next.memberId)
    const label = status === 'no_show' ? 'no-show' : status
    await logActivity(tx, { kind: 'session', message: `Marked PT session for ${member?.name ?? 'member'} as ${label}`, memberId: next.memberId, refType: 'session', refId: id })
    return next
  })
}

export async function deleteSession(id: string): Promise<void> {
  return writeTx(['sessions', 'members', 'activity'], async (tx) => {
    const s = await tx.objectStore('sessions').get(id)
    if (!s) return
    if (s.status !== 'scheduled') throw new DomainError('session-done', 'Only scheduled sessions can be removed. Completed and cancelled ones are kept for history.')
    await tx.objectStore('sessions').delete(id)
    const member = await tx.objectStore('members').get(s.memberId)
    await logActivity(tx, { kind: 'session', message: `Removed a scheduled PT session for ${member?.name ?? 'member'}`, memberId: s.memberId })
  })
}
