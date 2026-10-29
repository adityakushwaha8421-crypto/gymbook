import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { closeDb, getDb } from './db'
import { createMember, setMemberArchived, updateMember, listMembers, getMember } from './services/members'
import { createPlan } from './services/plans'
import { assignMembership } from './services/memberships'
import { recordPayment, listInvoices, listPayments, listAdjustments, voidPayment, voidInvoice, addAdjustment } from './services/payments'
import { checkIn, checkOut, listAttendanceForMember, MembershipRequiredError } from './services/attendance'
import { invoiceBalance, memberBalance } from '@/domain/membership'
import { exportBackup, validateBackup, importBackup } from './backup'
import { seedSampleData, removeSampleRecords } from './sample'
import { armSaveFailure } from './failpoint'
import { saveSchedule, createTrainer } from './services/trainers'
import { StorageError } from './errors'

const TZ = 'Asia/Kolkata'
const today = '2026-10-28'

beforeEach(async () => {
  await closeDb()
  indexedDB = new IDBFactory()
  await getDb()
})

async function memberAndPlan() {
  const member = await createMember({ name: 'Test Person', phone: '9876543210', joiningDate: today })
  const plan = await createPlan({ name: 'Monthly', durationValue: 1, durationUnit: 'months', price: 150000 })
  return { member, plan }
}

describe('membership sale → partial payment → settle → invoice', () => {
  it('creates membership, invoice and payments transactionally and derives balance', async () => {
    const { member, plan } = await memberAndPlan()
    const sale = await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 10000, initialPaymentPaise: 50000, paymentMethod: 'upi' })
    expect(sale.membership.endDate).toBe('2026-11-27')
    expect(sale.invoiceNumber).toBe('RK-00001')
    expect(sale.membership.pricePaise).toBe(140000)
    const inv = (await listInvoices())[0]
    expect(inv.totalPaise).toBe(140000)
    let bal = invoiceBalance(inv, await listPayments(), await listAdjustments())
    expect(bal.status).toBe('partial')
    expect(bal.balancePaise).toBe(90000)

    await expect(recordPayment({ memberId: member.id, invoiceId: inv.id, amountPaise: 100000, method: 'cash', receivedAt: new Date().toISOString() })).rejects.toThrow(/outstanding/)

    await recordPayment({ memberId: member.id, invoiceId: inv.id, amountPaise: 90000, method: 'cash', receivedAt: new Date().toISOString() })
    bal = invoiceBalance(inv, await listPayments(), await listAdjustments())
    expect(bal.status).toBe('paid')
    expect(bal.balancePaise).toBe(0)
    expect(memberBalance(await listInvoices(), await listPayments(), await listAdjustments()).balancePaise).toBe(0)
  })

  it('allocates invoice numbers sequentially and never reuses them', async () => {
    const { member, plan } = await memberAndPlan()
    const a = await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })
    const b = await assignMembership({ memberId: member.id, planId: plan.id, startDate: '2026-11-28', discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash', renewalOfId: a.membership.id })
    expect(a.invoiceNumber).toBe('RK-00001')
    expect(b.invoiceNumber).toBe('RK-00002')
    expect(b.membership.startDate).toBe('2026-11-28')
    expect(b.membership.endDate).toBe('2026-12-27')
    expect(b.membership.renewalOfId).toBe(a.membership.id)
  })

  it('snapshots plan details so later plan edits do not change the sale', async () => {
    const { member, plan } = await memberAndPlan()
    const sale = await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })
    const { updatePlan } = await import('./services/plans')
    await updatePlan(plan.id, plan.rev, { name: 'Monthly Plus', durationValue: 2, durationUnit: 'months', price: 250000 })
    expect(sale.membership.planName).toBe('Monthly')
    expect(sale.membership.listPricePaise).toBe(150000)
  })

  it('idempotency key prevents double submission', async () => {
    const { member, plan } = await memberAndPlan()
    const key = 'req-1'
    const [a, b] = await Promise.all([
      assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash', requestKey: key }),
      assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash', requestKey: key }),
    ])
    expect(a.invoiceId).toBe(b.invoiceId)
    expect((await listInvoices()).length).toBe(1)
  })

  it('void and adjustments keep history', async () => {
    const { member, plan } = await memberAndPlan()
    const sale = await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 50000, paymentMethod: 'cash' })
    const pay = sale.payment!
    await voidPayment(pay.id, pay.rev, 'entered twice')
    const payments = await listPayments()
    expect(payments.length).toBe(1)
    expect(payments[0].status).toBe('void')
    await addAdjustment({ invoiceId: sale.invoiceId, amountPaise: -50000, reason: 'goodwill' })
    const bal = invoiceBalance((await listInvoices())[0], payments, await listAdjustments())
    expect(bal.duePaise).toBe(100000)
    expect(bal.balancePaise).toBe(100000)
  })
})

describe('attendance', () => {
  it('rejects duplicate open check-ins and expired memberships, allows override with reason', async () => {
    const { member, plan } = await memberAndPlan()
    await expect(checkIn({ memberId: member.id, today })).rejects.toBeInstanceOf(MembershipRequiredError)
    const forced = await checkIn({ memberId: member.id, today, overrideReason: 'owner approved' })
    expect(forced.overrideReason).toBe('owner approved')
    await checkOut(forced.id, forced.rev)
    await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })
    const visit = await checkIn({ memberId: member.id, today })
    expect(visit.overrideReason).toBeUndefined()
    await expect(checkIn({ memberId: member.id, today })).rejects.toThrow(/already checked in/)
    const out = await checkOut(visit.id, visit.rev)
    expect(out.checkOutAt).toBeTruthy()
    await expect(checkOut(visit.id, visit.rev)).rejects.toBeInstanceOf(StorageError) // stale rev → conflict
    expect((await listAttendanceForMember(member.id)).length).toBe(2)
  })
})

describe('archive keeps history', () => {
  it('archives without deleting invoices/payments', async () => {
    const { member, plan } = await memberAndPlan()
    await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 150000, paymentMethod: 'cash' })
    const m = (await getMember(member.id))!
    const archived = await setMemberArchived(m.id, m.rev, true)
    expect(archived.status).toBe('archived')
    expect((await listInvoices()).length).toBe(1)
    expect((await listPayments()).length).toBe(1)
    await expect(assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })).rejects.toThrow(/Restore/)
  })
})

describe('concurrency', () => {
  it('refuses writes based on a stale revision (simulates another tab)', async () => {
    const { member } = await memberAndPlan()
    await updateMember(member.id, member.rev, { name: 'Tab A', phone: member.phone, joiningDate: today })
    await expect(updateMember(member.id, member.rev, { name: 'Tab B', phone: member.phone, joiningDate: today })).rejects.toMatchObject({ kind: 'conflict' })
    expect((await getMember(member.id))!.name).toBe('Tab A')
  })
})

describe('failure handling', () => {
  it('a simulated storage failure writes nothing', async () => {
    const { member, plan } = await memberAndPlan()
    armSaveFailure()
    await expect(assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })).rejects.toMatchObject({ kind: 'simulated' })
    expect((await listInvoices()).length).toBe(0)
    const ok = await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })
    expect(ok.invoiceNumber).toBe('RK-00001')
  })
})

describe('backup', () => {
  it('round-trips and rejects invalid files without touching data', async () => {
    const { member, plan } = await memberAndPlan()
    await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })
    const backup = await exportBackup()
    const bad = validateBackup('{"format":"gymbook-backup","version":1,"exportedAt":"x","data":{}}')
    expect(bad.ok).toBe(false)
    const broken = structuredClone(backup)
    broken.data.payments.push({ ...broken.data.invoices[0], id: 'pay_x', memberId: 'missing', amountPaise: 100, method: 'cash', receivedAt: 'x', status: 'recorded' } as never)
    const brokenPreview = validateBackup(JSON.stringify(broken))
    expect(brokenPreview.ok).toBe(false)
    expect(brokenPreview.errors.join(' ')).toMatch(/missing member/)
    expect((await listMembers()).length).toBe(1)

    await createMember({ name: 'Extra', phone: '9999999999', joiningDate: today })
    expect((await listMembers()).length).toBe(2)
    const good = validateBackup(JSON.stringify(backup))
    expect(good.ok).toBe(true)
    await importBackup(good.backup!)
    expect((await listMembers()).length).toBe(1)
    const next = await assignMembership({ memberId: member.id, planId: plan.id, startDate: '2026-11-28', discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })
    expect(next.invoiceNumber).toBe('RK-00002')
  })
})

describe('sample data', () => {
  it('seeds labelled records and removes only them', async () => {
    await createMember({ name: 'Real Person', phone: '9123456789', joiningDate: today })
    await seedSampleData(TZ)
    const all = await listMembers()
    expect(all.filter((m) => m.sample).length).toBeGreaterThan(5)
    const invoices = await listInvoices()
    expect(new Set(invoices.map((i) => i.number)).size).toBe(invoices.length)
    const removed = await removeSampleRecords()
    expect(removed).toBeGreaterThan(0)
    const after = await listMembers()
    expect(after.length).toBe(1)
    expect(after[0].name).toBe('Real Person')
  })
})

describe('trainer schedules', () => {
  it('rejects overlapping slots', async () => {
    const t = await createTrainer({ name: 'Coach', phone: '9000000000', specialty: 'Strength' })
    await saveSchedule(t.id, { weekday: 1, startTime: '06:00', endTime: '10:00', label: 'Morning' })
    await expect(saveSchedule(t.id, { weekday: 1, startTime: '09:00', endTime: '11:00', label: 'Late' })).rejects.toThrow(/Overlaps/)
    await saveSchedule(t.id, { weekday: 1, startTime: '10:00', endTime: '11:00', label: 'Adjacent' })
    await saveSchedule(t.id, { weekday: 2, startTime: '09:00', endTime: '11:00', label: 'Other day' })
  })
})

describe('voiding an invoice cancels its membership', () => {
  it('marks the membership cancelled, hides it from current/renewal logic and blocks check-in', async () => {
    const { member, plan } = await memberAndPlan()
    const sale = await assignMembership({ memberId: member.id, planId: plan.id, startDate: today, discountPaise: 0, initialPaymentPaise: 0, paymentMethod: 'cash' })
    const inv = (await listInvoices())[0]
    await voidInvoice(inv.id, inv.rev, 'sold by mistake')
    const { listMembershipsForMember } = await import('./services/memberships')
    const { pickCurrentMembership, membershipState } = await import('@/domain/membership')
    const list = await listMembershipsForMember(member.id)
    expect(list).toHaveLength(1)
    expect(list[0].cancelledAt).toBeTruthy()
    expect(list[0].rev).toBe(sale.membership.rev + 1)
    expect(membershipState(list[0], today)).toBe('cancelled')
    expect(pickCurrentMembership(list, today)).toBeUndefined()
    await expect(checkIn({ memberId: member.id, today })).rejects.toBeInstanceOf(MembershipRequiredError)
  })
})

describe('PT sessions, equipment and workouts', () => {
  const tz = 'Asia/Kolkata'
  it('assigns sequential member codes and finds members by code', async () => {
    const a = await createMember({ name: 'Code One', phone: '9000000001', joiningDate: today })
    const b = await createMember({ name: 'Code Two', phone: '9000000002', joiningDate: today })
    expect(a.memberCode).toBe('GB-0001')
    expect(b.memberCode).toBe('GB-0002')
    const { filterMembers } = await import('@/components/domain/MemberPicker')
    expect(filterMembers([{ member: a }, { member: b }], 'gb-0002').map((r) => r.member.name)).toEqual(['Code Two'])
    expect(filterMembers([{ member: a }, { member: b }], 'GB0001').map((r) => r.member.name)).toEqual(['Code One'])
  })

  it('refuses double-booking a trainer or a member, allows adjacent sessions', async () => {
    const { createTrainer } = await import('./services/trainers')
    const { saveSession, setSessionStatus, listSessions, deleteSession } = await import('./services/sessions')
    const t1 = await createTrainer({ name: 'Coach A', phone: '9000000010', specialty: 'Strength' })
    const t2 = await createTrainer({ name: 'Coach B', phone: '9000000011', specialty: 'Yoga' })
    const m1 = await createMember({ name: 'Session One', phone: '9000000003', joiningDate: today })
    const m2 = await createMember({ name: 'Session Two', phone: '9000000004', joiningDate: today })
    const base = { startAt: `${today}T09:00`, startAtInstant: new Date(`${today}T03:30:00.000Z`).toISOString(), durationMinutes: 60, note: undefined }
    const s1 = await saveSession({ ...base, trainerId: t1.id, memberId: m1.id }, tz)
    // same trainer, overlapping start
    await expect(saveSession({ ...base, trainerId: t1.id, memberId: m2.id, startAtInstant: new Date(`${today}T04:00:00.000Z`).toISOString() }, tz)).rejects.toThrow(/Coach A already has a session/)
    // same member, other trainer, overlapping
    await expect(saveSession({ ...base, trainerId: t2.id, memberId: m1.id, startAtInstant: new Date(`${today}T04:00:00.000Z`).toISOString() }, tz)).rejects.toThrow(/Session One already has a session/)
    // adjacent (starts exactly when the first ends) is fine
    const s2 = await saveSession({ ...base, trainerId: t1.id, memberId: m2.id, startAtInstant: new Date(`${today}T04:30:00.000Z`).toISOString() }, tz)
    expect(s2.status).toBe('scheduled')
    // a cancelled session no longer blocks the slot
    await setSessionStatus(s1.id, s1.rev, 'cancelled')
    const s3 = await saveSession({ ...base, trainerId: t1.id, memberId: m1.id }, tz)
    expect(s3.id).not.toBe(s1.id)
    expect((await listSessions()).length).toBe(3)
    await expect(deleteSession(s1.id)).rejects.toThrow(/Only scheduled/)
    await deleteSession(s3.id)
    expect((await listSessions()).length).toBe(2)
  })

  it('tracks equipment incidents through their lifecycle', async () => {
    const { createEquipment, reportIncident, setIncidentStatus, setEquipmentArchived, listEquipment, listIncidents } = await import('./services/equipment')
    const eq = await createEquipment({ name: 'Treadmill X', category: 'Cardio', status: 'ok', location: undefined, serial: undefined, purchasedOn: undefined, notes: undefined })
    const inc = await reportIncident({ equipmentId: eq.id, title: 'Belt slipping', severity: 'high', reportedBy: 'Reception', note: undefined, markEquipment: 'out_of_order' })
    expect((await listEquipment())[0].status).toBe('out_of_order')
    const fresh = (await listEquipment())[0]
    await expect(setEquipmentArchived(fresh.id, fresh.rev, true)).rejects.toThrow(/open incidents/)
    const prog = await setIncidentStatus(inc.id, inc.rev, 'in_progress')
    await expect(setIncidentStatus(prog.id, prog.rev, 'resolved', { resolution: '' })).rejects.toThrow(/resolved/)
    const done = await setIncidentStatus(prog.id, prog.rev, 'resolved', { resolution: 'Belt replaced', equipmentStatus: 'ok' })
    expect(done.resolvedAt).toBeTruthy()
    expect((await listEquipment())[0].status).toBe('ok')
    expect((await listIncidents())[0].resolution).toBe('Belt replaced')
  })

  it('copies a library template and assigns it to a member', async () => {
    const { createWorkoutFromTemplate, assignWorkout, listWorkouts, setWorkoutArchived } = await import('./services/workouts')
    const m = await createMember({ name: 'Plan Person', phone: '9000000005', joiningDate: today })
    const w = await createWorkoutFromTemplate('beginner-full-body')
    expect(w.source).toBe('library')
    expect(w.days.length).toBe(3)
    await assignWorkout(m.id, m.rev, w.id)
    expect((await getMember(m.id))!.workoutPlanId).toBe(w.id)
    const archived = await setWorkoutArchived(w.id, w.rev, true)
    const m2 = (await getMember(m.id))!
    await expect(assignWorkout(m2.id, m2.rev, archived.id)).rejects.toThrow(/archived/)
    expect((await listWorkouts()).length).toBe(1)
  })

  it('backs up and restores the new stores', async () => {
    const { createEquipment } = await import('./services/equipment')
    const { createWorkoutFromTemplate } = await import('./services/workouts')
    await createEquipment({ name: 'Rack', category: 'Strength', status: 'ok', location: undefined, serial: undefined, purchasedOn: undefined, notes: undefined })
    await createWorkoutFromTemplate('fat-loss-circuit')
    const b = await exportBackup()
    expect(b.data.equipment.length).toBe(1)
    expect(b.data.workouts.length).toBe(1)
    const preview = validateBackup(JSON.stringify(b))
    expect(preview.ok).toBe(true)
    expect(preview.counts.equipment).toBe(1)
    await importBackup(preview.backup!)
    expect((await exportBackup()).data.workouts[0].name).toBe('Fat-loss circuits')
  })
})
