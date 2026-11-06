import { ALL_STORES, readTx, writeTx } from './db'
import { addDays, membershipEndDate, todayInTz, startOfDayInstant, formatDate } from '@/domain/dates'
import type { Attendance, FollowUp, Invoice, Member, Membership, Payment, Plan, Settings, WorkoutPlan } from '@/domain/types'
import { stampNew, logActivity } from './repo'
import { DEFAULT_SETTINGS } from './services/settings'
import { buildInvoice } from './services/invoicing'
import { WORKOUT_LIBRARY } from '@/domain/workoutLibrary'

/**
 * Deterministic, clearly-labelled sample dataset. Every record carries
 * `sample: true` and member names are prefixed "Sample" so they cannot be
 * mistaken for real gym records. Only seeded on explicit request.
 */
export async function seedSampleData(timezone: string): Promise<void> {
  const today = todayInTz(timezone)
  const at = (date: string, hour: number, minute = 0) => {
    const base = new Date(startOfDayInstant(date, timezone))
    base.setUTCMinutes(base.getUTCMinutes() + hour * 60 + minute)
    return base.toISOString()
  }
  const S = true

  const plans: Plan[] = [
    stampNew('plan', { name: 'Monthly', durationValue: 1, durationUnit: 'months' as const, pricePaise: 150000, description: 'Full gym floor access, 1 month', archived: false }, S),
    stampNew('plan', { name: 'Quarterly', durationValue: 3, durationUnit: 'months' as const, pricePaise: 400000, description: '3 months, best value for regulars', archived: false }, S),
    stampNew('plan', { name: 'Half-yearly', durationValue: 6, durationUnit: 'months' as const, pricePaise: 720000, archived: false }, S),
    stampNew('plan', { name: '10-day trial', durationValue: 10, durationUnit: 'days' as const, pricePaise: 50000, description: 'Short trial for new joiners', archived: false }, S),
  ] as Plan[]

  type Spec = { name: string; phone: string; joined: number; plan: number; start: number; paid: number; discount?: number; renewals?: number; notes?: string; archived?: boolean; goal?: string; health?: string; dob?: string; gender?: 'female' | 'male' | 'other'; height?: number; weight?: number }
  const specs: Spec[] = [
    { name: 'Sample Aarav Mehta', phone: '98100 00011', joined: -200, plan: 1, start: -40, paid: 400000, renewals: 1, goal: 'Strength', dob: '1992-04-18', gender: 'male', height: 176, weight: 78.5 },
    { name: 'Sample Diya Sharma', phone: '98100 00012', joined: -95, plan: 0, start: -25, paid: 150000, goal: 'Mobility', health: 'Mild lower-back pain; avoid heavy deadlifts', dob: '1988-11-02', gender: 'female', height: 160, weight: 58 },
    { name: 'Sample Kabir Singh', phone: '98100 00013', joined: -60, plan: 0, start: -27, paid: 100000, notes: 'Prefers evening slots' },
    { name: 'Sample Ananya Iyer', phone: '98100 00014', joined: -400, plan: 2, start: -170, paid: 720000, renewals: 1, goal: 'Fat loss', dob: '1995-07-30', gender: 'female', height: 164, weight: 71.5 },
    { name: 'Sample Vihaan Reddy', phone: '98100 00015', joined: -30, plan: 3, start: -12, paid: 50000 },
    { name: 'Sample Ishaan Kapoor', phone: '98100 00016', joined: -120, plan: 0, start: -45, paid: 150000 },
    { name: 'Sample Meera Joshi', phone: '98100 00017', joined: -10, plan: 0, start: -3, paid: 50000, discount: 10000 },
    { name: 'Sample Arjun Das', phone: '98100 00018', joined: -250, plan: 1, start: -88, paid: 400000 },
    { name: 'Sample Sara Khan', phone: '98100 00019', joined: -5, plan: 0, start: 2, paid: 0 },
    { name: 'Sample Rahul Bose', phone: '98100 00020', joined: -300, plan: 0, start: -75, paid: 150000, archived: true },
    { name: 'Sample Nisha Pillai', phone: '98100 00021', joined: -20, plan: 0, start: -5, paid: 150000 },
    { name: 'Sample Dev Malhotra', phone: '98100 00022', joined: -150, plan: 1, start: -2, paid: 200000 },
  ]

  const members: Member[] = []
  let memberSeq = (await readTx(['counters'], async (tx) => (await tx.objectStore('counters').get('member'))?.value)) ?? 0
  const memberships: Membership[] = []
  const invoices: Invoice[] = []
  const payments: Payment[] = []
  // Invoice numbers continue after whatever the gym has already issued, so
  // seeding never collides with real invoices or rewinds the counter.
  const { prefix, start: counterStart } = await readTx(['settings', 'counters'], async (tx) => ({
    prefix: (await tx.objectStore('settings').get('settings'))?.invoicePrefix ?? DEFAULT_SETTINGS.invoicePrefix,
    start: (await tx.objectStore('counters').get('invoice'))?.value ?? 0,
  }))
  let seq = counterStart

  for (const s of specs) {
    const member = stampNew('mem', {
      name: s.name,
      phone: s.phone,
      joiningDate: addDays(today, s.joined),
      status: s.archived ? ('archived' as const) : ('active' as const),
      notes: s.notes,
      archivedAt: s.archived ? at(addDays(today, -15), 10) : undefined,
      memberCode: `GB-${String(++memberSeq).padStart(4, '0')}`,
      goal: s.goal,
      healthNotes: s.health,
      dateOfBirth: s.dob,
      gender: s.gender,
      heightCm: s.height,
      weightKg: s.weight,
    }, S) as Member
    members.push(member)
    const plan = plans[s.plan]
    const start = addDays(today, s.start)
    let prevId: string | undefined
    const rounds = (s.renewals ?? 0) + 1
    // Build chronologically: earliest first.
    const starts: string[] = []
    {
      let st = start
      for (let k = 1; k < rounds; k++) {
        // step backwards one duration at a time
        const prevEndExclusive = st
        const prevStart = plan.durationUnit === 'months' ? addDaysBackMonths(prevEndExclusive, plan.durationValue) : addDays(prevEndExclusive, -plan.durationValue)
        st = prevStart
      }
      starts.push(st)
      for (let k = 1; k < rounds; k++) {
        const end = membershipEndDate(st, plan.durationValue, plan.durationUnit)
        st = addDays(end, 1)
        starts.push(st)
      }
    }
    for (let idx = 0; idx < starts.length; idx++) {
      const st = starts[idx]
      const isLast = idx === starts.length - 1
      const end = membershipEndDate(st, plan.durationValue, plan.durationUnit)
      seq += 1
      const discount = isLast ? (s.discount ?? 0) : 0
      const invoice = buildInvoice({
        number: `${prefix}-${String(seq).padStart(5, '0')}`,
        memberId: member.id,
        issueDate: st <= today ? st : today,
        lines: [{ description: `${plan.name} membership (${plan.durationValue} ${plan.durationUnit}) · ${formatDate(st)} to ${formatDate(end)}`, quantity: 1, unitPricePaise: plan.pricePaise, amountPaise: plan.pricePaise }],
        discountPaise: discount,
        sample: S,
      })
      const ms = { ...stampNew('ms', {}, S), memberId: member.id, planId: plan.id, planName: plan.name, durationValue: plan.durationValue, durationUnit: plan.durationUnit, startDate: st, endDate: end, listPricePaise: plan.pricePaise, discountPaise: discount, pricePaise: plan.pricePaise - discount, invoiceId: invoice.id, renewalOfId: prevId } as Membership
      invoice.membershipId = ms.id
      invoices.push(invoice)
      memberships.push(ms)
      prevId = ms.id
      const paid = isLast ? s.paid : plan.pricePaise
      if (paid > 0) {
        payments.push(stampNew('pay', { memberId: member.id, invoiceId: invoice.id, amountPaise: paid, method: idx % 2 === 0 ? ('upi' as const) : ('cash' as const), receivedAt: at(st <= today ? st : today, 10, 30), status: 'recorded' as const, note: 'Paid at membership sale' }, S) as Payment)
      }
    }
  }

  // Attendance for the last 21 days: regulars visit most weekdays.
  const attendance: Attendance[] = []
  const regulars = [0, 1, 2, 3, 5, 7, 10, 11]
  for (let d = 21; d >= 0; d--) {
    const date = addDays(today, -d)
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay()
    if (weekday === 0) continue
    regulars.forEach((mi, k) => {
      if ((d + k) % 3 === 0) return
      const m = members[mi]
      const msFor = memberships.filter((x) => x.memberId === m.id)
      const covered = msFor.some((x) => x.startDate <= date && date <= x.endDate)
      if (!covered) return
      const hour = 6 + (k % 3) * 5 + (d % 2)
      const checkIn = at(date, hour, (k * 7) % 60)
      const isTodayOpen = d === 0 && k < 2
      const out = isTodayOpen ? null : new Date(new Date(checkIn).getTime() + (50 + (k * 11) % 40) * 60_000).toISOString()
      attendance.push(stampNew('att', { memberId: m.id, checkInAt: checkIn, checkOutAt: out, source: 'manual' as const }, S) as Attendance)
    })
  }

  const workouts: WorkoutPlan[] = WORKOUT_LIBRARY.slice(0, 3).map((t) => stampNew('wk', { name: t.name, goal: t.goal, description: t.description, source: 'library' as const, days: t.days.map((d) => ({ title: d.title, exercises: d.exercises.map((e) => ({ ...e })) })), archived: false }, S) as WorkoutPlan)
  members[0].workoutPlanId = workouts[2].id
  members[1].workoutPlanId = workouts[0].id
  members[3].workoutPlanId = workouts[1].id

  const followups: FollowUp[] = [
    stampNew('fu', { type: 'payment' as const, memberId: members[2].id, dueDate: addDays(today, 1), assignee: 'Reception', note: 'Collect remaining ₹500 for monthly plan', status: 'open' as const }, S),
    stampNew('fu', { type: 'expiry' as const, memberId: members[1].id, dueDate: addDays(today, 3), assignee: 'Reception', note: 'Monthly plan ending soon; offer quarterly', status: 'open' as const }, S),
    stampNew('fu', { type: 'lead' as const, leadName: 'Sample Tara Menon', leadPhone: '98100 00099', dueDate: today, assignee: 'Reception', note: 'Asked about yoga timings on walk-in', status: 'open' as const }, S),
    stampNew('fu', { type: 'expiry' as const, memberId: members[5].id, dueDate: addDays(today, -4), note: 'Membership lapsed; call to renew', status: 'done' as const, completedAt: at(addDays(today, -4), 15) }, S),
  ] as FollowUp[]

  await writeTx(ALL_STORES, async (tx) => {
    const put = async (store: (typeof ALL_STORES)[number], rows: unknown[]) => {
      const os = tx.objectStore(store) as unknown as { put: (v: unknown) => Promise<unknown> }
      for (const r of rows) await os.put(r)
    }
    await put('plans', plans)
    await put('members', members)
    await put('memberships', memberships)
    await put('invoices', invoices)
    await put('payments', payments)
    await put('attendance', attendance)
    await put('followups', followups)
    await put('workouts', workouts)
    const memberCounter = (await tx.objectStore('counters').get('member'))?.value ?? 0
    await tx.objectStore('counters').put({ key: 'member', value: Math.max(memberCounter, memberSeq) })
    const counter = (await tx.objectStore('counters').get('invoice'))?.value ?? 0
    await tx.objectStore('counters').put({ key: 'invoice', value: Math.max(counter, seq) })
    const current = (await tx.objectStore('settings').get('settings')) ?? DEFAULT_SETTINGS
    const settings: Settings = {
      ...current,
      address: current.address || '12, Sample Street, Sample Nagar',
      timezone,
      dataMode: 'sample',
      rev: current.rev + 1,
      updatedAt: new Date().toISOString(),
    }
    await tx.objectStore('settings').put(settings)
    await logActivity(tx, { kind: 'system', message: 'Loaded labelled sample data' })
  })
}

function addDaysBackMonths(date: string, months: number): string {
  // Inverse of addMonths used only for constructing earlier sample rounds.
  const [y, m, d] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) - months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`
}

/** Remove every sample-flagged record without touching real records. */
export async function removeSampleRecords(): Promise<number> {
  let removed = 0
  await writeTx(ALL_STORES, async (tx) => {
    for (const store of ALL_STORES) {
      if (store === 'settings' || store === 'counters' || store === 'activity') continue
      const os = tx.objectStore(store)
      const rows = (await os.getAll()) as { id: string; sample?: boolean }[]
      for (const r of rows) {
        if (r.sample) {
          await (os as unknown as { delete: (k: string) => Promise<void> }).delete(r.id)
          removed += 1
        }
      }
    }
    const current = (await tx.objectStore('settings').get('settings')) ?? DEFAULT_SETTINGS
    await tx.objectStore('settings').put({ ...current, dataMode: 'empty', rev: current.rev + 1, updatedAt: new Date().toISOString() })
    await logActivity(tx, { kind: 'system', message: `Removed ${removed} sample records` })
  })
  return removed
}
