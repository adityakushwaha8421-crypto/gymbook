import { createWriteStream } from 'node:fs'
import { once } from 'node:events'

/**
 * Builds a large, made-up gym as a GymBook backup file, for volume testing only.
 * Every member is named "Vol …" so the records cannot be mistaken for a real gym's.
 * The output is deterministic for a given tier and day, and is written as a stream so
 * a file of several hundred MB never has to exist as one string in the test process.
 */

export interface Tier {
  name: string
  members: number
  /** How far back the oldest member joined. */
  years: number
  /** Chance that a member with a running membership visits on a given day. */
  visitProb: number
  /** Share of members that have a photo (0 to 1). */
  photoShare: number
}

export const TIERS: Record<string, Tier> = {
  // An ordinary neighbourhood gym after two years: about 25 visits a day.
  gym: { name: 'gym', members: 300, years: 2, visitProb: 0.3, photoShare: 1 },
  // A busy single gym after three years: about 100 visits a day.
  busy: { name: 'busy', members: 1500, years: 3, visitProb: 0.3, photoShare: 1 },
  // A very large gym after five years.
  large: { name: 'large', members: 5000, years: 5, visitProb: 0.3, photoShare: 0.5 },
  // Several large gyms' worth of history in one browser.
  xlarge: { name: 'xlarge', members: 10000, years: 5, visitProb: 0.3, photoShare: 0.3 },
  // Far beyond one gym: a stress test for where things stop working.
  huge: { name: 'huge', members: 20000, years: 6, visitProb: 0.3, photoShare: 0.2 },
  // Small tier for checking the harness itself.
  smoke: { name: 'smoke', members: 120, years: 1, visitProb: 0.3, photoShare: 1 },
}

export interface Generated {
  path: string
  bytes: number
  today: string
  counts: Record<string, number>
  /** Facts the app must reproduce exactly from this data. */
  expect: { liveMembers: number; archivedMembers: number; activeMembers: number; outstandingPaise: number; membersWithBalance: number; visitsToday: number; checkedInNow: number }
  /** A member with a running membership, used for search, check-in and payment steps. */
  probe: { id: string; name: string; phone: string; code: string }
  /** A member who owes money. */
  debtor: { id: string; name: string; owesPaise: number; invoiceId: string }
}

const FIRST = ['Aarav', 'Diya', 'Kabir', 'Ananya', 'Vihaan', 'Ishaan', 'Meera', 'Arjun', 'Sara', 'Rahul', 'Nisha', 'Dev', 'Pooja', 'Rohan', 'Sneha', 'Amit', 'Kavya', 'Yash', 'Priya', 'Sagar', 'Tanvi', 'Omkar', 'Neha', 'Sahil', 'Rutuja', 'Ganesh', 'Shruti', 'Mahesh', 'Aditi', 'Vikram']
const LAST = ['Patil', 'Deshmukh', 'Jadhav', 'Shinde', 'Pawar', 'Kulkarni', 'Joshi', 'More', 'Gaikwad', 'Bhoir', 'Mhatre', 'Thakur', 'Sharma', 'Yadav', 'Khan', 'Iyer', 'Reddy', 'Das', 'Mehta', 'Singh']
const PLANS = [
  { name: 'Monthly', durationValue: 1, durationUnit: 'months' as const, pricePaise: 150000 },
  { name: 'Quarterly', durationValue: 3, durationUnit: 'months' as const, pricePaise: 400000 },
  { name: 'Half-yearly', durationValue: 6, durationUnit: 'months' as const, pricePaise: 720000 },
  { name: 'Yearly', durationValue: 12, durationUnit: 'months' as const, pricePaise: 1200000 },
  { name: '10-day trial', durationValue: 10, durationUnit: 'days' as const, pricePaise: 50000 },
]
const METHODS = ['cash', 'upi', 'bank', 'card'] as const

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 86400000
const IST = 5.5 * 3600000
const dayToISO = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)
/** Instant for a wall-clock time on a gym day (Asia/Kolkata). */
const at = (day: number, minutes: number) => new Date(day * DAY + minutes * 60000 - IST).toISOString()
const id = (prefix: string, n: number) => `${prefix}_v${n.toString(36).padStart(7, '0')}`

function addMonths(day: number, months: number): number {
  const d = new Date(day * DAY)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d.getUTCDate(), last))
  return Math.round(target.getTime() / DAY)
}

export async function generate(tier: Tier, photos: string[], path: string): Promise<Generated> {
  const rand = mulberry32(20261107 + tier.members)
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
  const today = Math.floor((Date.now() + IST) / DAY)
  const nowMinutes = Math.floor(((Date.now() + IST) % DAY) / 60000)

  const out = createWriteStream(path)
  let bytes = 0
  const write = async (s: string) => {
    bytes += Buffer.byteLength(s)
    if (!out.write(s)) await once(out, 'drain')
  }
  /** Write one store as a JSON array, pulling rows from a generator so they are never all in memory. */
  const writeArray = async (key: string, rows: Iterable<unknown>, last = false) => {
    await write(`"${key}":[`)
    let first = true
    let batch = ''
    for (const r of rows) {
      batch += (first ? '' : ',') + JSON.stringify(r)
      first = false
      if (batch.length > 1 << 20) {
        await write(batch)
        batch = ''
      }
    }
    await write(batch + (last ? ']' : '],'))
  }

  /** A time of day for a record made on `day`; never later than now, so nothing is dated in the future. */
  const timeOn = (day: number, minutes: number) => at(day, day === today ? Math.min(minutes, Math.max(0, nowMinutes - 1)) : minutes)
  const stamp = (prefix: string, n: number, created: string) => ({ id: id(prefix, n), createdAt: created, updatedAt: created, rev: 0 })
  const plans = PLANS.map((p, i) => ({ ...stamp('plan', i, at(today - tier.years * 365 - 5, 600)), ...p, archived: false }))

  type Row = Record<string, unknown>
  const members: Row[] = []
  const memberships: Row[] = []
  const invoices: Row[] = []
  const payments: Row[] = []
  const followups: Row[] = []
  /** Per membership: member index, first and last day it gives access up to today. */
  const cover: { m: number; from: number; to: number }[] = []
  const counts: Record<string, number> = {}
  const exp = { liveMembers: 0, archivedMembers: 0, activeMembers: 0, outstandingPaise: 0, membersWithBalance: 0, visitsToday: 0, checkedInNow: 0 }
  let probe: Generated['probe'] | undefined
  let debtor: Generated['debtor'] | undefined
  let seq = 0

  for (let i = 0; i < tier.members; i++) {
    const joined = today - int(0, tier.years * 365)
    const archived = rand() < 0.04
    const name = `Vol ${FIRST[int(0, FIRST.length - 1)]} ${LAST[int(0, LAST.length - 1)]} ${String(i + 1).padStart(5, '0')}`
    const phone = `9${String(100000000 + i).padStart(9, '0')}`
    const code = `GB-${String(i + 1).padStart(4, '0')}`
    const created = timeOn(joined, int(420, 1200))
    members.push({
      ...stamp('mem', i, created),
      name,
      phone,
      joiningDate: dayToISO(joined),
      status: archived ? 'archived' : 'active',
      archivedAt: archived ? at(Math.min(today, joined + 200), 600) : undefined,
      memberCode: code,
      gender: rand() < 0.3 ? 'female' : 'male',
      goal: rand() < 0.5 ? 'Strength' : undefined,
      photoDataUrl: rand() < tier.photoShare ? photos[i % photos.length] : undefined,
    })
    if (archived) exp.archivedMembers++
    else exp.liveMembers++

    let start = joined
    let prev: string | undefined
    let owed = 0
    let active = false
    let lastInvoice: string | undefined
    while (start <= today + 5) {
      const plan = plans[rand() < 0.55 ? 0 : rand() < 0.6 ? 1 : int(2, 4)]
      const end = (plan.durationUnit === 'months' ? addMonths(start, plan.durationValue) : start + plan.durationValue) - 1
      const sold = Math.min(start, today)
      const soldAt = timeOn(sold, int(420, 1200))
      const discount = rand() < 0.15 ? int(1, 5) * 10000 : 0
      const net = plan.pricePaise - discount
      const n = ++seq
      const membershipId = id('ms', n)
      const invoiceId = id('inv', n)
      memberships.push({ ...stamp('ms', n, soldAt), memberId: id('mem', i), planId: plan.id, planName: plan.name, durationValue: plan.durationValue, durationUnit: plan.durationUnit, startDate: dayToISO(start), endDate: dayToISO(end), listPricePaise: plan.pricePaise, discountPaise: discount, pricePaise: net, invoiceId, renewalOfId: prev })
      invoices.push({ ...stamp('inv', n, soldAt), number: `VT-${String(n).padStart(5, '0')}`, memberId: id('mem', i), membershipId, issueDate: dayToISO(sold), lines: [{ description: `${plan.name} membership`, quantity: 1, unitPricePaise: plan.pricePaise, amountPaise: plan.pricePaise }], subtotalPaise: plan.pricePaise, discountPaise: discount, totalPaise: net, status: 'issued' })
      const roll = rand()
      const paid = roll < 0.86 ? net : roll < 0.95 ? Math.floor(net / 20000) * 10000 : 0
      if (paid > 0) payments.push({ ...stamp('pay', n, soldAt), memberId: id('mem', i), invoiceId, amountPaise: paid, method: METHODS[int(0, 3)], receivedAt: soldAt, status: 'recorded' })
      owed += net - paid
      if (net - paid > 0) lastInvoice = invoiceId
      if (start <= today && end >= today) active = true
      if (start <= today) cover.push({ m: i, from: start, to: Math.min(end, today) })
      prev = membershipId
      if (rand() < 0.3) break
      start = end + 1 + (rand() < 0.7 ? 0 : int(1, 25))
    }
    if (!archived) {
      if (active) exp.activeMembers++
      if (owed > 0) {
        exp.outstandingPaise += owed
        exp.membersWithBalance++
        if (!debtor && lastInvoice) debtor = { id: id('mem', i), name, owesPaise: owed, invoiceId: lastInvoice }
      }
      if (active && !probe && i > tier.members / 2) probe = { id: id('mem', i), name, phone, code }
      if (rand() < 0.02) followups.push({ ...stamp('fu', i, created), type: 'expiry', memberId: id('mem', i), dueDate: dayToISO(today + int(-3, 10)), status: 'open', note: 'Call about renewal' })
    }
  }

  // Attendance and the activity log are by far the largest stores, so they are produced lazily.
  const memberName = (i: number) => members[i].name as string
  let attSeq = 0
  function* attendance(): Generator<Row> {
    const r = mulberry32(99 + tier.members)
    for (const c of cover) {
      for (let day = c.from; day <= c.to; day++) {
        if (r() >= tier.visitProb) continue
        const isToday = day === today
        const inMin = isToday ? Math.max(0, nowMinutes - 1 - Math.floor(r() * Math.min(nowMinutes, 600))) : 360 + Math.floor(r() * 900)
        const stay = 45 + Math.floor(r() * 60)
        const open = isToday && r() < 0.5
        const n = attSeq++
        if (isToday) {
          exp.visitsToday++
          if (open) exp.checkedInNow++
        }
        yield { ...stamp('att', n, at(day, inMin)), memberId: id('mem', c.m), checkInAt: at(day, inMin), checkOutAt: open ? null : at(day, Math.min(inMin + stay, isToday ? nowMinutes : 1439)), source: 'manual' }
      }
    }
    counts.attendance = attSeq
  }
  // The app writes one activity line per member added, sale, payment and check-in. Check-outs are left out here.
  let actSeq = 0
  function* activity(): Generator<Row> {
    for (const m of members) yield { id: id('act', actSeq++), at: m.createdAt, kind: 'member', message: `Added member ${m.name as string}`, memberId: m.id }
    for (const m of memberships) yield { id: id('act', actSeq++), at: m.createdAt, kind: 'membership', message: `Sold ${m.planName as string}`, memberId: m.memberId, refType: 'membership', refId: m.id }
    for (const p of payments) yield { id: id('act', actSeq++), at: p.createdAt, kind: 'payment', message: 'Recorded a payment', memberId: p.memberId, refType: 'payment', refId: p.id }
    const r = mulberry32(99 + tier.members)
    for (const c of cover) {
      for (let day = c.from; day <= c.to; day++) {
        if (r() >= tier.visitProb) continue
        const isToday = day === today
        const inMin = isToday ? Math.max(0, nowMinutes - 1 - Math.floor(r() * Math.min(nowMinutes, 600))) : 360 + Math.floor(r() * 900)
        r()
        if (isToday) r()
        yield { id: id('act', actSeq++), at: at(day, inMin), kind: 'attendance', message: `${memberName(c.m)} checked in`, memberId: id('mem', c.m) }
      }
    }
    counts.activity = actSeq
  }

  const settings = { id: 'settings', rev: 1, updatedAt: at(today, 60), gymName: 'Volume Test Gym', address: 'Test data only', phone: '', email: '', currency: 'INR', timezone: 'Asia/Kolkata', invoicePrefix: 'VT', invoiceFooter: 'Volume test data', dataMode: 'empty' }
  await write(`{"format":"gymbook-backup","version":1,"exportedAt":"${new Date().toISOString()}","dbVersion":2,"data":{`)
  await writeArray('members', members)
  await writeArray('plans', plans)
  await writeArray('memberships', memberships)
  await writeArray('invoices', invoices)
  await writeArray('adjustments', [])
  await writeArray('payments', payments)
  await writeArray('attendance', attendance())
  await writeArray('trainers', [])
  await writeArray('schedules', [])
  await writeArray('expenses', [])
  await writeArray('followups', followups)
  await writeArray('sessions', [])
  await writeArray('equipment', [])
  await writeArray('incidents', [])
  await writeArray('workouts', [])
  await write(`"settings":${JSON.stringify(settings)},`)
  await writeArray('activity', activity())
  await writeArray('counters', [{ key: 'invoice', value: seq }, { key: 'member', value: tier.members }], true)
  await write('}}')
  out.end()
  await once(out, 'finish')

  Object.assign(counts, { members: members.length, plans: plans.length, memberships: memberships.length, invoices: invoices.length, payments: payments.length, followups: followups.length })
  if (!probe || !debtor) throw new Error('The generated data has no active member or no member who owes money; raise the member count.')
  return { path, bytes, today: dayToISO(today), counts, expect: exp, probe, debtor }
}
