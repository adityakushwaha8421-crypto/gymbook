import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { closeDb, getDb } from './db'
import { createMember, setMemberArchived, updateMember, getMember, listMembers } from './services/members'
import { createPlan, setPlanArchived } from './services/plans'
import { assignMembership } from './services/memberships'
import { recordPayment, listInvoices, listPayments, listAdjustments, voidPayment, voidInvoice, addAdjustment, getInvoice } from './services/payments'
import { checkIn, checkOut, listAttendanceForMember } from './services/attendance'
import { updateSettings, getSettings } from './services/settings'
import { invoiceBalance } from '@/domain/membership'
import { exportBackup, validateBackup, importBackup, type Backup } from './backup'
import { seedSampleData, removeSampleRecords } from './sample'
import { withIdempotency } from './repo'
import { DomainError, StorageError } from './errors'
import { todayInTz } from '@/domain/dates'

const TZ = 'Asia/Kolkata'
const today = '2026-10-28'

beforeEach(async () => {
  await closeDb()
  indexedDB = new IDBFactory()
  await getDb()
})

async function memberAndPlan(price = 150000) {
  const member = await createMember({ name: 'Test Person', phone: '9876543210', joiningDate: today })
  const plan = await createPlan({ name: 'Monthly', durationValue: 1, durationUnit: 'months', price })
  return { member, plan }
}
const sale = (memberId: string, planId: string, over: Partial<Parameters<typeof assignMembership>[0]> = {}) =>
  assignMembership({ memberId, planId, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash', issueDate: today, ...over })

// ---------------------------------------------------------------------------
// assignMembership
// ---------------------------------------------------------------------------
describe('assignMembership guards', () => {
  it('rejects discount above price, negative discount, negative or excessive initial payment', async () => {
    const { member, plan } = await memberAndPlan()
    await expect(sale(member.id, plan.id, { discountPaise: 150001 })).rejects.toMatchObject({ code: 'discount' })
    await expect(sale(member.id, plan.id, { discountPaise: -1 })).rejects.toMatchObject({ code: 'discount' })
    await expect(sale(member.id, plan.id, { initialPaymentPaise: -1 })).rejects.toMatchObject({ code: 'payment' })
    await expect(sale(member.id, plan.id, { discountPaise: 50000, initialPaymentPaise: 100001 })).rejects.toMatchObject({ code: 'payment' })
    expect((await listInvoices()).length).toBe(0)
    await expect((await getDb()).get('counters', 'invoice')).resolves.toBeUndefined()
  })
  it('a 100% discount creates a zero-total invoice that is already paid', async () => {
    const { member, plan } = await memberAndPlan()
    const r = await sale(member.id, plan.id, { discountPaise: 150000 })
    const inv = (await getInvoice(r.invoiceId))!
    expect(inv.totalPaise).toBe(0)
    expect(r.payment).toBeUndefined()
    expect(invoiceBalance(inv, [], []).status).toBe('paid')
  })
  it('refuses archived plans and archived members, and missing ids', async () => {
    const { member, plan } = await memberAndPlan()
    const archivedPlan = await setPlanArchived(plan.id, plan.rev, true)
    await expect(sale(member.id, archivedPlan.id)).rejects.toMatchObject({ code: 'plan-archived' })
    await setPlanArchived(plan.id, archivedPlan.rev, false)
    const m = (await getMember(member.id))!
    await setMemberArchived(m.id, m.rev, true)
    await expect(sale(member.id, plan.id)).rejects.toMatchObject({ code: 'member-archived' })
    await expect(sale('nope', plan.id)).rejects.toMatchObject({ code: 'member-missing' })
    await expect(sale(member.id, 'nope')).rejects.toBeInstanceOf(DomainError)
  })
  it('a failed sale does not consume an invoice number', async () => {
    const { member, plan } = await memberAndPlan()
    await expect(sale(member.id, plan.id, { discountPaise: 999999 })).rejects.toBeInstanceOf(DomainError)
    const ok = await sale(member.id, plan.id)
    expect(ok.invoiceNumber).toBe('RK-00001')
  })
  it('uses the invoice prefix from settings', async () => {
    const { member, plan } = await memberAndPlan()
    await updateSettings({ invoicePrefix: 'GYM' })
    const r = await sale(member.id, plan.id)
    expect(r.invoiceNumber).toBe('GYM-00001')
  })
  it('defaults issueDate to the calendar date in the gym timezone when the caller omits it', async () => {
    const { member, plan } = await memberAndPlan()
    await updateSettings({ timezone: TZ })
    // 20:00Z on 27 Oct is 01:30 IST on 28 Oct: the sale happens "today" = 28 Oct for the gym.
    vi.setSystemTime(new Date('2026-10-27T20:00:00.000Z'))
    try {
      const r = await sale(member.id, plan.id, { issueDate: undefined })
      const inv = (await getInvoice(r.invoiceId))!
      // BUG: memberships.ts:77 falls back to `nowIso().slice(0, 10)`, i.e. the UTC date (2026-10-27), not the
      // gym's date. Settings are already in the transaction; use `todayInTz(settings.timezone)` instead.
      expect(inv.issueDate).toBe(todayInTz(TZ, new Date('2026-10-27T20:00:00.000Z')))
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------
// recordPayment / voidPayment / voidInvoice / addAdjustment
// ---------------------------------------------------------------------------
describe('payments', () => {
  it('rejects zero/negative amounts, another member’s invoice and void invoices', async () => {
    const { member, plan } = await memberAndPlan()
    const other = await createMember({ name: 'Other', phone: '9000000001', joiningDate: today })
    const r = await sale(member.id, plan.id)
    const base = { memberId: member.id, invoiceId: r.invoiceId, method: 'cash' as const, receivedAt: new Date().toISOString() }
    await expect(recordPayment({ ...base, amountPaise: 0 })).rejects.toMatchObject({ code: 'amount' })
    await expect(recordPayment({ ...base, amountPaise: -100 })).rejects.toMatchObject({ code: 'amount' })
    await expect(recordPayment({ ...base, memberId: other.id, amountPaise: 100 })).rejects.toMatchObject({ code: 'invoice-missing' })
    await expect(recordPayment({ ...base, invoiceId: 'nope', amountPaise: 100 })).rejects.toMatchObject({ code: 'invoice-missing' })
    const inv = (await getInvoice(r.invoiceId))!
    await voidInvoice(inv.id, inv.rev, 'mistake')
    await expect(recordPayment({ ...base, amountPaise: 100 })).rejects.toMatchObject({ code: 'invoice-void' })
    // an unlinked credit is still allowed for this member
    const credit = await recordPayment({ ...base, invoiceId: undefined, amountPaise: 100 })
    expect(credit.invoiceId).toBeUndefined()
    expect((await listPayments()).length).toBe(1)
  })
  it('allows recording a payment for an archived member (dues can still be collected)', async () => {
    const { member, plan } = await memberAndPlan()
    const r = await sale(member.id, plan.id)
    const m = (await getMember(member.id))!
    await setMemberArchived(m.id, m.rev, true)
    const p = await recordPayment({ memberId: member.id, invoiceId: r.invoiceId, amountPaise: 1000, method: 'cash', receivedAt: new Date().toISOString() })
    expect(p.status).toBe('recorded')
  })
  it('voidPayment twice: fresh rev → already-void, stale rev → conflict; restores the invoice balance', async () => {
    const { member, plan } = await memberAndPlan()
    const r = await sale(member.id, plan.id, { initialPaymentPaise: 50000 })
    const p = r.payment!
    const voided = await voidPayment(p.id, p.rev, 'dup')
    await expect(voidPayment(p.id, voided.rev, 'again')).rejects.toMatchObject({ code: 'already-void' })
    await expect(voidPayment(p.id, p.rev, 'again')).rejects.toMatchObject({ kind: 'conflict' })
    await expect(voidPayment(p.id, voided.rev, '   ')).rejects.toMatchObject({ code: 'reason' })
    const inv = (await getInvoice(r.invoiceId))!
    expect(invoiceBalance(inv, await listPayments(), []).balancePaise).toBe(150000)
    // the full amount can now be paid again
    await recordPayment({ memberId: member.id, invoiceId: r.invoiceId, amountPaise: 150000, method: 'upi', receivedAt: new Date().toISOString() })
  })
  it('voidInvoice is refused with recorded payments but allowed once they are all void; twice → already-void', async () => {
    const { member, plan } = await memberAndPlan()
    const r = await sale(member.id, plan.id, { initialPaymentPaise: 50000 })
    let inv = (await getInvoice(r.invoiceId))!
    await expect(voidInvoice(inv.id, inv.rev, 'x')).rejects.toMatchObject({ code: 'has-payments' })
    await voidPayment(r.payment!.id, r.payment!.rev, 'refunded')
    inv = (await getInvoice(r.invoiceId))!
    const v = await voidInvoice(inv.id, inv.rev, 'cancelled')
    expect(v.status).toBe('void')
    await expect(voidInvoice(inv.id, v.rev, 'again')).rejects.toMatchObject({ code: 'already-void' })
    await expect(addAdjustment({ invoiceId: inv.id, amountPaise: -100, reason: 'x' })).rejects.toMatchObject({ code: 'invoice-void' })
  })
  it('addAdjustment can bring due to exactly 0 but not below; zero amount and blank reason refused', async () => {
    const { member, plan } = await memberAndPlan()
    const r = await sale(member.id, plan.id)
    await expect(addAdjustment({ invoiceId: r.invoiceId, amountPaise: 0, reason: 'x' })).rejects.toMatchObject({ code: 'amount' })
    await expect(addAdjustment({ invoiceId: r.invoiceId, amountPaise: -1, reason: ' ' })).rejects.toMatchObject({ code: 'reason' })
    await expect(addAdjustment({ invoiceId: r.invoiceId, amountPaise: -150001, reason: 'too much' })).rejects.toMatchObject({ code: 'too-low' })
    await addAdjustment({ invoiceId: r.invoiceId, amountPaise: -150000, reason: 'waived' })
    const inv = (await getInvoice(r.invoiceId))!
    const bal = invoiceBalance(inv, await listPayments(), await listAdjustments())
    expect(bal.duePaise).toBe(0)
    expect(bal.status).toBe('paid')
    await expect(addAdjustment({ invoiceId: r.invoiceId, amountPaise: -1, reason: 'more' })).rejects.toMatchObject({ code: 'too-low' })
    // a positive adjustment re-opens it
    await addAdjustment({ invoiceId: r.invoiceId, amountPaise: 500, reason: 'late fee' })
    expect(invoiceBalance(inv, await listPayments(), await listAdjustments()).status).toBe('unpaid')
    await expect(recordPayment({ memberId: member.id, invoiceId: r.invoiceId, amountPaise: 501, method: 'cash', receivedAt: 'x' })).rejects.toMatchObject({ code: 'overpay' })
  })
  it('an adjustment below what has already been paid is allowed and yields a credit', async () => {
    const { member, plan } = await memberAndPlan()
    const r = await sale(member.id, plan.id, { initialPaymentPaise: 150000 })
    await addAdjustment({ invoiceId: r.invoiceId, amountPaise: -50000, reason: 'goodwill' })
    const inv = (await getInvoice(r.invoiceId))!
    expect(invoiceBalance(inv, await listPayments(), await listAdjustments()).status).toBe('credit')
  })
})

// ---------------------------------------------------------------------------
// attendance / archive / updateRecord
// ---------------------------------------------------------------------------
describe('attendance and archiving', () => {
  it('checkOut twice with fresh rev → already-out; with stale rev → conflict', async () => {
    const { member } = await memberAndPlan()
    const visit = await checkIn({ memberId: member.id, today, overrideReason: 'ok' })
    const out = await checkOut(visit.id, visit.rev)
    await expect(checkOut(visit.id, out.rev)).rejects.toMatchObject({ code: 'already-out' })
    await expect(checkOut(visit.id, visit.rev)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(checkOut('missing', 1)).rejects.toMatchObject({ kind: 'not-found' })
  })
  it('an upcoming membership does not count as current for check-in', async () => {
    const { member, plan } = await memberAndPlan()
    await sale(member.id, plan.id, { startDate: '2026-10-29' })
    await expect(checkIn({ memberId: member.id, today })).rejects.toMatchObject({ code: 'membership-required' })
    const ok = await checkIn({ memberId: member.id, today: '2026-10-29' })
    expect(ok.overrideReason).toBeUndefined()
  })
  it('an override reason given while a membership is current is dropped', async () => {
    const { member, plan } = await memberAndPlan()
    await sale(member.id, plan.id)
    const v = await checkIn({ memberId: member.id, today, overrideReason: 'not needed' })
    expect(v.overrideReason).toBeUndefined()
  })
  it('archiving is refused while checked in, allowed after check-out; archived members cannot check in', async () => {
    const { member } = await memberAndPlan()
    const visit = await checkIn({ memberId: member.id, today, overrideReason: 'trial' })
    let m = (await getMember(member.id))!
    await expect(setMemberArchived(m.id, m.rev, true)).rejects.toMatchObject({ code: 'open-checkin' })
    await checkOut(visit.id, visit.rev)
    m = (await getMember(member.id))!
    const archived = await setMemberArchived(m.id, m.rev, true)
    expect(archived.archivedAt).toBeTruthy()
    await expect(checkIn({ memberId: member.id, today, overrideReason: 'x' })).rejects.toMatchObject({ code: 'member-archived' })
    const restored = await setMemberArchived(m.id, archived.rev, false)
    expect(restored.status).toBe('active')
    expect(restored.archivedAt).toBeUndefined()
    expect((await listAttendanceForMember(member.id)).length).toBe(1)
  })
  it('updateRecord on a missing id → not-found; wrong rev → conflict; undefined rev skips the check', async () => {
    const { member } = await memberAndPlan()
    const values = { name: 'Renamed', phone: member.phone, joiningDate: today }
    await expect(updateMember('nope', 1, values)).rejects.toMatchObject({ kind: 'not-found' })
    await expect(updateMember(member.id, 99, values)).rejects.toMatchObject({ kind: 'conflict' })
    const next = await updateMember(member.id, undefined as unknown as number, values)
    expect(next.rev).toBe(2)
    expect(next.name).toBe('Renamed')
  })
  it('updateSettings honours expectedRev', async () => {
    const s = await getSettings()
    const next = await updateSettings({ gymName: 'A' }, s.rev)
    await expect(updateSettings({ gymName: 'B' }, s.rev)).rejects.toMatchObject({ kind: 'conflict' })
    expect((await getSettings()).gymName).toBe('A')
    expect(next.rev).toBe(s.rev + 1)
  })
})

// ---------------------------------------------------------------------------
// withIdempotency
// ---------------------------------------------------------------------------
describe('withIdempotency', () => {
  it('a rejected call is retryable immediately; a resolved one is cached for ~5 s', async () => {
    let n = 0
    const key = 'k-' + Math.random()
    await expect(withIdempotency(key, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    vi.useFakeTimers()
    try {
      const first = await withIdempotency(key, async () => ++n)
      expect(first).toBe(1)
      expect(await withIdempotency(key, async () => ++n)).toBe(1) // cached, fn not called
      expect(n).toBe(1)
      vi.advanceTimersByTime(4999)
      expect(await withIdempotency(key, async () => ++n)).toBe(1)
      vi.advanceTimersByTime(2)
      expect(await withIdempotency(key, async () => ++n)).toBe(2)
    } finally {
      vi.useRealTimers()
    }
    // no key → never cached
    expect(await withIdempotency(undefined, async () => ++n)).toBe(3)
    expect(await withIdempotency(undefined, async () => ++n)).toBe(4)
  })
  it('concurrent calls with the same key share one in-flight promise', async () => {
    let n = 0
    const key = 'k2-' + Math.random()
    const slow = () => new Promise<number>((res) => setTimeout(() => res(++n), 5))
    const [a, b] = await Promise.all([withIdempotency(key, slow), withIdempotency(key, slow)])
    expect(a).toBe(1)
    expect(b).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// backup
// ---------------------------------------------------------------------------
describe('backup validation', () => {
  async function baseline(): Promise<Backup> {
    const { member, plan } = await memberAndPlan()
    await sale(member.id, plan.id, { initialPaymentPaise: 1000 })
    return exportBackup()
  }
  it('flags schedules that end at or before they start', async () => {
    const b = await baseline()
    const trainer = { ...b.data.members[0], id: 'tr_1', specialty: 'x', status: 'active' as const }
    b.data.trainers.push(trainer as never)
    b.data.schedules.push({ id: 's1', createdAt: 'x', updatedAt: 'x', rev: 1, trainerId: 'tr_1', weekday: 1, startMinutes: 600, endMinutes: 600, label: 'eq' })
    b.data.schedules.push({ id: 's2', createdAt: 'x', updatedAt: 'x', rev: 1, trainerId: 'tr_1', weekday: 1, startMinutes: 600, endMinutes: 540, label: 'lt' })
    const r = validateBackup(JSON.stringify(b))
    expect(r.ok).toBe(false)
    expect(r.errors.filter((e) => /ends before it starts/.test(e)).length).toBe(2)
  })
  it('accepts settings: null and imports defaults with dataMode empty', async () => {
    const b = await baseline()
    b.data.settings = null
    const r = validateBackup(JSON.stringify(b))
    expect(r.ok).toBe(true)
    expect(r.gymName).toBeUndefined()
    await importBackup(r.backup!)
    const s = await getSettings()
    expect(s.dataMode).toBe('empty')
    expect(s.gymName).toBe('R.K. Gym Fitness Centre')
  })
  it('memberships referencing an archived plan are fine; a missing plan is only a warning', async () => {
    const b = await baseline()
    b.data.plans[0].archived = true
    expect(validateBackup(JSON.stringify(b)).ok).toBe(true)
    b.data.plans = []
    const r = validateBackup(JSON.stringify(b))
    expect(r.ok).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/plan that no longer exists/)
  })
  it('flags a counter behind the highest invoice number and raises it on import', async () => {
    const b = await baseline()
    b.data.counters = [{ key: 'invoice', value: 0 }]
    b.data.invoices[0].number = 'RK-00007'
    const r = validateBackup(JSON.stringify(b))
    expect(r.ok).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/counter \(0\) is behind/)
    await importBackup(r.backup!)
    await expect((await getDb()).get('counters', 'invoice')).resolves.toEqual({ key: 'invoice', value: 7 })
    const { member, plan } = { member: b.data.members[0], plan: b.data.plans[0] }
    const next = await sale(member.id, plan.id, { startDate: '2026-12-01' })
    expect(next.invoiceNumber).toBe('RK-00008')
  })
  it('a missing invoice counter is created from the invoices on import', async () => {
    const b = await baseline()
    b.data.counters = []
    await importBackup(validateBackup(JSON.stringify(b)).backup!)
    const next = await sale(b.data.members[0].id, b.data.plans[0].id, { startDate: '2026-12-01' })
    expect(next.invoiceNumber).toBe('RK-00002')
  })
  it('rejects a payment linked to an invoice of a different member, and duplicate member codes', async () => {
    const b = await baseline()
    const other = { ...b.data.members[0], id: 'mem_other', name: 'Other', memberCode: 'GB-9999' }
    b.data.members.push(other)
    b.data.payments[0].memberId = 'mem_other'
    const r = validateBackup(JSON.stringify(b))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/different member/)
    const dup = await baseline()
    dup.data.members.push({ ...dup.data.members[0], id: 'mem_dup', name: 'Dup' })
    expect(validateBackup(JSON.stringify(dup)).errors.join(' ')).toMatch(/duplicate member code/)
  })
  it('round-trips export → import → export (ignoring exportedAt and activity)', async () => {
    await updateSettings({ gymName: 'Round Trip Gym', invoicePrefix: 'RT', dataMode: 'empty' })
    const b1 = await baseline()
    await recordPayment({ memberId: b1.data.members[0].id, amountPaise: 777, method: 'upi', receivedAt: new Date().toISOString() })
    await addAdjustment({ invoiceId: b1.data.invoices[0].id, amountPaise: -100, reason: 'r' })
    const full = await exportBackup()
    const r = validateBackup(JSON.stringify(full))
    expect(r.ok).toBe(true)
    await importBackup(r.backup!)
    const again = await exportBackup()
    // JSON round-trip drops keys whose value is undefined (zod's parse in validateBackup does the same).
    const strip = (b: Backup) => JSON.parse(JSON.stringify({ ...b, exportedAt: undefined, data: { ...b.data, activity: undefined } }))
    expect(strip(again)).toEqual(strip(full))
    expect(again.data.settings?.gymName).toBe('Round Trip Gym')
    expect(again.data.activity.length).toBe(full.data.activity.length + 1)
  })
  it('rejects garbage and wrong format without touching data', async () => {
    await baseline()
    expect(validateBackup('not json').errors[0]).toMatch(/not valid JSON/)
    expect(validateBackup('{"format":"other","version":1,"exportedAt":"x","data":{}}').errors[0]).toMatch(/not a GymBook backup/)
    expect((await listMembers()).length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// sample data
// ---------------------------------------------------------------------------
describe('sample data', () => {
  it('seeding twice continues the invoice numbering, and removal leaves no sample rows', async () => {
    await seedSampleData(TZ)
    const before = await exportBackup()
    // Second seed continues after the stored counter, so numbers stay unique and nothing collides.
    await expect(seedSampleData(TZ)).resolves.toBeUndefined()
    const after = await exportBackup()
    expect(after.data.members.length).toBe(before.data.members.length * 2)
    expect(after.data.invoices.length).toBe(before.data.invoices.length * 2)
    expect(new Set(after.data.invoices.map((i) => i.number)).size).toBe(after.data.invoices.length)
    const removed = await removeSampleRecords()
    expect(removed).toBeGreaterThan(0)
    const final = await exportBackup()
    for (const [store, rows] of Object.entries(final.data)) {
      if (!Array.isArray(rows)) continue
      expect(rows.filter((r) => (r as { sample?: boolean }).sample).length, store).toBe(0)
    }
    expect(final.data.members.length).toBe(0)
    expect(final.data.invoices.length).toBe(0)
    // counter never goes backwards, so future numbers cannot collide with anything that was ever issued
    const counter = final.data.counters.find((c) => c.key === 'invoice')!.value
    expect(counter).toBe(before.data.invoices.length * 2)
    expect((await getSettings()).dataMode).toBe('empty')
  })
  it('seeding into a database that already issued RK-00001 keeps invoice numbers unique', async () => {
    const { member, plan } = await memberAndPlan()
    await sale(member.id, plan.id)
    // BUG: sample.ts:102 hard-codes `INV-${seq}` from 1 and sample.ts:174 overwrites the counter with its own
    // sequence. With a real RK-00001 present, the unique index on invoices.number aborts the seed
    // (ConstraintError) and the user sees a generic storage error; sample data cannot be loaded at all.
    // Fix: allocate numbers via nextInvoiceNumber(tx) (or start from the stored counter) and never lower it.
    await expect(seedSampleData(TZ)).resolves.toBeUndefined()
    const invoices = await listInvoices()
    expect(new Set(invoices.map((i) => i.number)).size).toBe(invoices.length)
  })
  it('seeding never moves the invoice counter backwards', async () => {
    await (await getDb()).put('counters', { key: 'invoice', value: 20 })
    await updateSettings({ invoicePrefix: 'ABC' }) // sample numbers use INV-, so no unique-index clash
    await seedSampleData(TZ)
    // Sample numbers continue after the stored counter (ABC-00021…ABC-00034) and the counter follows.
    await expect((await getDb()).get('counters', 'invoice')).resolves.toEqual({ key: 'invoice', value: 34 })
    const invoices = await listInvoices()
    expect(invoices.every((i) => i.number.startsWith('ABC-'))).toBe(true)
    expect(invoices.some((i) => i.number === 'ABC-00021')).toBe(true)
  })
  it('sample invoices/memberships are internally consistent and today-relative', async () => {
    await seedSampleData(TZ)
    const b = await exportBackup()
    const r = validateBackup(JSON.stringify(b))
    expect(r.ok).toBe(true)
    expect(r.warnings).toEqual([])
    const t = todayInTz(TZ)
    for (const m of b.data.memberships) expect(m.endDate >= m.startDate).toBe(true)
    for (const i of b.data.invoices) expect(i.issueDate <= t).toBe(true)
    for (const p of b.data.payments) expect(p.receivedAt <= new Date().toISOString()).toBe(true)
    for (const m of b.data.memberships) {
      const inv = b.data.invoices.find((i) => i.id === m.invoiceId)!
      expect(inv.membershipId).toBe(m.id)
      expect(inv.totalPaise).toBe(m.pricePaise)
      expect(inv.memberId).toBe(m.memberId)
    }
  })
})
