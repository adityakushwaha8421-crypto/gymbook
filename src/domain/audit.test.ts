import { describe, it, expect } from 'vitest'
import {
  membershipEndDate,
  addMonths,
  addDays,
  diffDays,
  startOfDayInstant,
  instantToDateInTz,
  todayInTz,
  isISODate,
  eachDay,
  formatMonthKey,
  formatMinutes,
  dateRangeInstants,
} from './dates'
import { parseRupees, formatINRCompact, paiseToInput, formatINR } from './money'
import { csvCell, toCsv } from './csv'
import { invoiceBalance, memberBalance, membershipState, pickCurrentMembership, latestEndDate, daysRemaining } from './membership'
import { financeSummary, financeSeries, dashboardMetrics, periodPreset, memberRows } from './metrics'
import { phoneSchema, optionalEmail, settingsForm, followUpForm, scheduleForm, rupeesInput, toMinutes, normalizePhone, planForm } from './validation'
import type { Snapshot } from '@/data/snapshot'
import type { Invoice, Payment, Adjustment, Membership, Member, Attendance, Expense } from './types'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const base = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', rev: 1 }
const ms = (over: Partial<Membership>): Membership => ({
  ...base,
  id: 'ms',
  memberId: 'm',
  planId: 'p',
  planName: 'Monthly',
  durationValue: 1,
  durationUnit: 'months',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  listPricePaise: 150000,
  discountPaise: 0,
  pricePaise: 150000,
  invoiceId: 'i',
  ...over,
})
const inv = (over: Partial<Invoice>): Invoice => ({
  ...base,
  id: 'i',
  number: 'INV-00001',
  memberId: 'm',
  issueDate: '2026-10-01',
  lines: [],
  subtotalPaise: 150000,
  discountPaise: 0,
  totalPaise: 150000,
  status: 'issued',
  ...over,
})
const pay = (over: Partial<Payment>): Payment => ({
  ...base,
  id: 'p',
  memberId: 'm',
  invoiceId: 'i',
  amountPaise: 100000,
  method: 'cash',
  receivedAt: '2026-10-01T05:00:00.000Z',
  status: 'recorded',
  ...over,
})
const adj = (over: Partial<Adjustment>): Adjustment => ({ ...base, id: 'a', invoiceId: 'i', memberId: 'm', amountPaise: -50000, reason: 'x', ...over })
const member = (over: Partial<Member>): Member => ({ ...base, id: 'm', name: 'M', phone: '9876543210', joiningDate: '2026-01-01', status: 'active', ...over })
const att = (over: Partial<Attendance>): Attendance => ({ ...base, id: 'att', memberId: 'm', checkInAt: '2026-10-28T04:00:00.000Z', checkOutAt: null, source: 'manual', ...over })
const exp = (over: Partial<Expense>): Expense => ({ ...base, id: 'e', date: '2026-10-15', category: 'rent', amountPaise: 1000, method: 'cash', ...over })
const snap = (over: Partial<Snapshot>): Snapshot => ({
  members: [],
  plans: [],
  memberships: [],
  invoices: [],
  adjustments: [],
  payments: [],
  attendance: [],
  trainers: [],
  schedules: [],
  expenses: [],
  followups: [],
  ...over,
})

// ---------------------------------------------------------------------------
// 1. Money
// ---------------------------------------------------------------------------
describe('money: parseRupees edge cases', () => {
  it('accepts lenient but unambiguous shapes', () => {
    expect(parseRupees('1.')).toBe(100)
    expect(parseRupees('.5')).toBe(50)
    expect(parseRupees('00012')).toBe(1200)
    expect(parseRupees(' 12 ')).toBe(1200)
    expect(parseRupees('12.5.1')).toBeNull()
    expect(parseRupees('1.2.')).toBeNull()
  })
  it('strips every comma, so a mis-grouped "1,2,3" parses as 123 rupees (documented, lenient)', () => {
    expect(parseRupees('1,2,3')).toBe(12300)
  })
  it('rejects the unicode minus sign instead of mis-parsing it', () => {
    expect(parseRupees('−12')).toBeNull()
  })
  it('returns a plain 0 for "-0"', () => {
    expect(Object.is(parseRupees('-0'), 0)).toBe(true)
  })
  it('refuses values whose paise total exceeds MAX_SAFE_INTEGER', () => {
    // 90071992547409.91 rupees → 9007199254740991 paise (exactly MAX_SAFE_INTEGER) is fine.
    expect(parseRupees('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER)
    // BUG: money.ts:52 checks Number.isSafeInteger(rupees) but not the paise total.
    // '90071992547410' rupees → 9007199254741000 paise > MAX_SAFE_INTEGER, returned as an unsafe float instead of null.
    // Fix: `if (!Number.isSafeInteger(total)) return null` after computing total.
    const big = parseRupees('90071992547410')
    expect(big === null || Number.isSafeInteger(big)).toBe(true)
  })
  it('rejects a 17-digit rupee figure outright', () => {
    expect(parseRupees('99999999999999999')).toBeNull()
  })
})

describe('money: formatting', () => {
  it('formatINRCompact drops paise only when exactly zero and never rounds', () => {
    expect(formatINRCompact(150000)).toBe('₹1,500')
    expect(formatINRCompact(150001)).toBe('₹1,500.01')
    expect(formatINRCompact(99)).toBe('₹0.99')
    expect(formatINRCompact(-150000)).toBe('-₹1,500')
    expect(formatINRCompact(-150050)).toBe('-₹1,500.50')
    expect(formatINRCompact(0)).toBe('₹0')
  })
  it('paiseToInput handles negatives and round-trips through parseRupees', () => {
    expect(paiseToInput(-5)).toBe('-0.05')
    expect(paiseToInput(-150000)).toBe('-1500')
    expect(paiseToInput(-150050)).toBe('-1500.50')
    expect(paiseToInput(0)).toBe('0')
    expect(parseRupees(paiseToInput(-150050))).toBe(-150050)
    expect(parseRupees(paiseToInput(-5))).toBe(-5)
  })
  it('formatINR of a large amount uses Indian grouping', () => {
    expect(formatINR(1234567890)).toBe('₹1,23,45,678.90')
  })
})

// ---------------------------------------------------------------------------
// 2. Dates
// ---------------------------------------------------------------------------
describe('dates: membershipEndDate', () => {
  it('clamps month plans that start late in January (non-leap)', () => {
    // Policy: exclusive end = addMonths (clamped), inclusive end = that − 1 day.
    // Consequence: 28, 29, 30 and 31 Jan all end on 27 Feb in a non-leap year.
    expect(membershipEndDate('2026-01-28', 1, 'months')).toBe('2026-02-27')
    expect(membershipEndDate('2026-01-29', 1, 'months')).toBe('2026-02-27')
    expect(membershipEndDate('2026-01-30', 1, 'months')).toBe('2026-02-27')
    expect(membershipEndDate('2026-01-31', 1, 'months')).toBe('2026-02-27')
  })
  it('clamps month plans that start late in January (leap)', () => {
    expect(membershipEndDate('2028-01-29', 1, 'months')).toBe('2028-02-28')
    expect(membershipEndDate('2028-01-30', 1, 'months')).toBe('2028-02-28')
    expect(membershipEndDate('2028-01-31', 1, 'months')).toBe('2028-02-28')
    expect(membershipEndDate('2028-02-29', 1, 'months')).toBe('2028-03-28')
    expect(membershipEndDate('2028-02-29', 12, 'months')).toBe('2029-02-27')
  })
  it('handles multi-month and year-crossing plans', () => {
    expect(membershipEndDate('2026-10-31', 1, 'months')).toBe('2026-11-29')
    expect(membershipEndDate('2026-12-31', 2, 'months')).toBe('2027-02-27')
    expect(membershipEndDate('2026-12-31', 1, 'months')).toBe('2027-01-30')
    expect(membershipEndDate('2026-01-15', 12, 'months')).toBe('2027-01-14')
    expect(membershipEndDate('2026-03-01', 1, 'months')).toBe('2026-03-31')
    expect(membershipEndDate('2026-03-01', 1, 'days')).toBe('2026-03-01')
  })
  it('a day plan of n days covers exactly n days', () => {
    expect(diffDays('2026-03-01', membershipEndDate('2026-03-01', 30, 'days')) + 1).toBe(30)
  })
})

describe('dates: addMonths / addDays / diffDays', () => {
  it('crosses year boundaries both ways', () => {
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-01-31', -2)).toBe('2025-11-30')
    expect(addMonths('2026-06-15', 0)).toBe('2026-06-15')
    expect(addMonths('2026-06-15', 24)).toBe('2028-06-15')
    expect(addMonths('2026-06-15', -18)).toBe('2024-12-15')
  })
  it('addDays normalises across month ends and negative offsets', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })
  it('diffDays is sign-aware and DST-free', () => {
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2)
    expect(diffDays('2026-03-09', '2026-03-07')).toBe(-2)
    expect(diffDays('2025-12-31', '2026-01-01')).toBe(1)
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364)
  })
})

describe('dates: startOfDayInstant in DST timezones', () => {
  const backToLocal = (instant: string, tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .format(new Date(instant))
      .replace(', ', 'T')
  it('America/New_York spring-forward day (2026-03-08) starts at 05:00Z', () => {
    const i = startOfDayInstant('2026-03-08', 'America/New_York')
    expect(i).toBe('2026-03-08T05:00:00.000Z')
    expect(backToLocal(i, 'America/New_York')).toBe('2026-03-08T00:00')
    // the day after is EDT: 04:00Z
    expect(startOfDayInstant('2026-03-09', 'America/New_York')).toBe('2026-03-09T04:00:00.000Z')
  })
  it('America/New_York fall-back day (2026-11-01) starts at 04:00Z', () => {
    const i = startOfDayInstant('2026-11-01', 'America/New_York')
    expect(i).toBe('2026-11-01T04:00:00.000Z')
    expect(backToLocal(i, 'America/New_York')).toBe('2026-11-01T00:00')
    expect(startOfDayInstant('2026-11-02', 'America/New_York')).toBe('2026-11-02T05:00:00.000Z')
  })
  it('Europe/London BST start (2026-03-29) starts at 00:00Z and the next day at 23:00Z', () => {
    expect(startOfDayInstant('2026-03-29', 'Europe/London')).toBe('2026-03-29T00:00:00.000Z')
    expect(startOfDayInstant('2026-03-30', 'Europe/London')).toBe('2026-03-29T23:00:00.000Z')
    expect(startOfDayInstant('2026-10-25', 'Europe/London')).toBe('2026-10-24T23:00:00.000Z')
    expect(startOfDayInstant('2026-10-26', 'Europe/London')).toBe('2026-10-26T00:00:00.000Z')
  })
  it('a timezone whose DST jump happens at midnight (America/Santiago) still maps back to the first instant of that date', () => {
    // Chile: clocks skip from 24:00 Sat 5 Sep to 01:00 Sun 6 Sep 2026; local 00:00 does not exist.
    const i = startOfDayInstant('2026-09-06', 'America/Santiago')
    expect(instantToDateInTz(i, 'America/Santiago')).toBe('2026-09-06')
    const before = new Date(new Date(i).getTime() - 60_000).toISOString()
    expect(instantToDateInTz(before, 'America/Santiago')).toBe('2026-09-05')
  })
  it('dateRangeInstants covers a DST-transition day exactly (23 h or 25 h)', () => {
    const r = dateRangeInstants('2026-03-08', '2026-03-08', 'America/New_York')
    expect((new Date(r.to).getTime() - new Date(r.from).getTime()) / 3_600_000).toBe(23)
    const r2 = dateRangeInstants('2026-11-01', '2026-11-01', 'America/New_York')
    expect((new Date(r2.to).getTime() - new Date(r2.from).getTime()) / 3_600_000).toBe(25)
  })
})

describe('dates: instantToDateInTz / todayInTz around midnight', () => {
  it('IST midnight is 18:30Z', () => {
    expect(instantToDateInTz('2026-10-27T18:29:59.999Z', 'Asia/Kolkata')).toBe('2026-10-27')
    expect(instantToDateInTz('2026-10-27T18:30:00.000Z', 'Asia/Kolkata')).toBe('2026-10-28')
    expect(todayInTz('Asia/Kolkata', new Date('2026-10-27T18:30:00.000Z'))).toBe('2026-10-28')
    expect(todayInTz('UTC', new Date('2026-10-27T18:30:00.000Z'))).toBe('2026-10-27')
    expect(instantToDateInTz('2026-12-31T23:30:00.000Z', 'Asia/Kolkata')).toBe('2027-01-01')
  })
  it('instantToDateInTz pads single-digit months and days', () => {
    expect(instantToDateInTz('2026-01-05T12:00:00.000Z', 'Asia/Kolkata')).toBe('2026-01-05')
  })
})

describe('dates: isISODate / eachDay / formatMonthKey / formatMinutes', () => {
  it('isISODate rejects impossible and unpadded dates', () => {
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('2026-13-01')).toBe(false)
    expect(isISODate('2026-2-3')).toBe(false)
    expect(isISODate('2026-00-10')).toBe(false)
    expect(isISODate('2026-04-31')).toBe(false)
    expect(isISODate('2024-02-29')).toBe(true)
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2026-02-28T00:00')).toBe(false)
    expect(isISODate(20260228)).toBe(false)
  })
  it('eachDay is inclusive, empty for reversed ranges and capped by the guard', () => {
    expect(eachDay('2026-01-01', '2026-01-03')).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(eachDay('2026-01-03', '2026-01-01')).toEqual([])
    expect(eachDay('2026-01-01', '2026-01-01')).toEqual(['2026-01-01'])
    expect(eachDay('2000-01-01', '2030-01-01').length).toBe(5000)
  })
  it('formatMonthKey renders a month label', () => {
    expect(formatMonthKey('2026-01')).toBe('Jan 2026')
    expect(formatMonthKey('2026-12')).toBe('Dec 2026')
  })
  it('formatMinutes handles midnight, noon and end-of-day', () => {
    expect(formatMinutes(0)).toBe('12:00 am')
    expect(formatMinutes(720)).toBe('12:00 pm')
    expect(formatMinutes(1439)).toBe('11:59 pm')
    // BUG: dates.ts:197 — formatMinutes(1440) (24:00, which the backup schema and scheduleForm allow) renders "12:00 pm".
    // Fix: `const h = Math.floor(mins / 60) % 24` before computing the suffix.
    expect(formatMinutes(1440)).toBe('12:00 am')
  })
})

// ---------------------------------------------------------------------------
// 3. Membership state and balances
// ---------------------------------------------------------------------------
describe('membership: state boundaries', () => {
  const m = ms({ startDate: '2026-10-10', endDate: '2026-10-31' })
  it('expiring window is inclusive of exactly 7 days left', () => {
    expect(membershipState(m, '2026-10-24')).toBe('expiring') // 7 days left
    expect(membershipState(m, '2026-10-23')).toBe('active') // 8 days left
    expect(membershipState(m, '2026-10-31')).toBe('expiring') // 0 days left, still valid today
    expect(membershipState(m, '2026-11-01')).toBe('expired')
    expect(membershipState(m, '2026-10-10')).toBe('active') // starts today
    expect(membershipState(m, '2026-10-09')).toBe('upcoming')
    expect(membershipState(m, '2026-10-24', 0)).toBe('active')
    expect(membershipState(m, '2026-10-31', 0)).toBe('expiring')
  })
  it('daysRemaining goes negative after expiry', () => {
    expect(daysRemaining(m, '2026-10-31')).toBe(0)
    expect(daysRemaining(m, '2026-11-03')).toBe(-3)
  })
  it('a one-day membership is expiring on its only day', () => {
    expect(membershipState(ms({ startDate: '2026-10-10', endDate: '2026-10-10' }), '2026-10-10')).toBe('expiring')
  })
})

describe('membership: pickCurrentMembership / latestEndDate', () => {
  const a = ms({ id: 'a', startDate: '2026-10-01', endDate: '2026-10-31' })
  const b = ms({ id: 'b', startDate: '2026-10-15', endDate: '2026-11-14' })
  const up1 = ms({ id: 'up1', startDate: '2026-12-01', endDate: '2026-12-31' })
  const up2 = ms({ id: 'up2', startDate: '2026-11-20', endDate: '2026-12-19' })
  it('prefers the overlapping current membership with the later end date', () => {
    expect(pickCurrentMembership([a, b], '2026-10-20')?.id).toBe('b')
    expect(pickCurrentMembership([b, a], '2026-10-20')?.id).toBe('b')
  })
  it('with only upcoming memberships, picks the one starting soonest', () => {
    expect(pickCurrentMembership([up1, up2], '2026-10-20')?.id).toBe('up2')
  })
  it('with only expired memberships, picks the most recently ended', () => {
    expect(pickCurrentMembership([a, b], '2027-01-01')?.id).toBe('b')
  })
  it('prefers a current membership over an upcoming one and an upcoming over an expired one', () => {
    expect(pickCurrentMembership([a, up1], '2026-10-20')?.id).toBe('a')
    expect(pickCurrentMembership([a, up1], '2026-11-05')?.id).toBe('up1')
  })
  it('returns undefined for an empty list', () => {
    expect(pickCurrentMembership([], '2026-10-20')).toBeUndefined()
    expect(latestEndDate([])).toBeUndefined()
  })
  it('latestEndDate ignores start order', () => {
    expect(latestEndDate([up1, a, b, up2])).toBe('2026-12-31')
  })
})

describe('membership: invoiceBalance / memberBalance', () => {
  it('void invoice with recorded payments reports status void and a negative balance (credit)', () => {
    const v = inv({ status: 'void' })
    const bal = invoiceBalance(v, [pay({ amountPaise: 50000 })], [])
    expect(bal.status).toBe('void')
    expect(bal.duePaise).toBe(0)
    expect(bal.paidPaise).toBe(50000)
    expect(bal.balancePaise).toBe(-50000)
    // the member's overall balance treats that payment as credit
    expect(memberBalance([v], [pay({ amountPaise: 50000 })], []).balancePaise).toBe(-50000)
  })
  it('adjustments on a void invoice do not change the due amount', () => {
    const v = inv({ status: 'void' })
    const bal = invoiceBalance(v, [], [adj({ amountPaise: 20000 })])
    expect(bal.duePaise).toBe(0)
    expect(bal.adjustmentsPaise).toBe(20000)
  })
  it('memberBalance is negative (credit) when payments exceed invoices, including unlinked credits', () => {
    const b = memberBalance([inv({})], [pay({ amountPaise: 150000 }), pay({ id: 'p2', invoiceId: undefined, amountPaise: 10000 })], [])
    expect(b.invoicedPaise).toBe(150000)
    expect(b.paidPaise).toBe(160000)
    expect(b.balancePaise).toBe(-10000)
  })
  it('an adjustment that reduces due below what was paid yields credit status', () => {
    const bal = invoiceBalance(inv({}), [pay({ amountPaise: 150000 })], [adj({ amountPaise: -50000 })])
    expect(bal.status).toBe('credit')
    expect(bal.balancePaise).toBe(-50000)
  })
  it('ignores payments and adjustments that belong to other invoices', () => {
    const bal = invoiceBalance(inv({}), [pay({ invoiceId: 'other' })], [adj({ invoiceId: 'other' })])
    expect(bal.paidPaise).toBe(0)
    expect(bal.adjustmentsPaise).toBe(0)
    expect(bal.status).toBe('unpaid')
  })
  it('a zero-total invoice is paid', () => {
    expect(invoiceBalance(inv({ totalPaise: 0 }), [], []).status).toBe('paid')
  })
})

// ---------------------------------------------------------------------------
// 4. Metrics
// ---------------------------------------------------------------------------
describe('metrics: financeSummary period inclusivity', () => {
  const TZ = 'Asia/Kolkata'
  const period = { start: '2026-10-01', end: '2026-10-31' }
  it('includes both period ends and excludes the days just outside, using the gym timezone for instants', () => {
    const s = snap({
      payments: [
        pay({ id: 'p1', receivedAt: '2026-09-30T18:30:00.000Z', amountPaise: 1 }), // 1 Oct 00:00 IST → in
        pay({ id: 'p2', receivedAt: '2026-09-30T18:29:59.000Z', amountPaise: 10 }), // 30 Sep 23:59 IST → out
        pay({ id: 'p3', receivedAt: '2026-10-31T18:29:59.000Z', amountPaise: 100 }), // 31 Oct 23:59 IST → in
        pay({ id: 'p4', receivedAt: '2026-10-31T18:30:00.000Z', amountPaise: 1000 }), // 1 Nov 00:00 IST → out
        pay({ id: 'p5', receivedAt: '2026-10-15T10:00:00.000Z', amountPaise: 10000, status: 'void' }),
      ],
      invoices: [inv({ id: 'i1', issueDate: '2026-10-01', totalPaise: 1 }), inv({ id: 'i2', issueDate: '2026-10-31', totalPaise: 10 }), inv({ id: 'i3', issueDate: '2026-11-01', totalPaise: 100 }), inv({ id: 'i4', issueDate: '2026-10-15', totalPaise: 1000, status: 'void' })],
      expenses: [exp({ id: 'e1', date: '2026-10-01', amountPaise: 1 }), exp({ id: 'e2', date: '2026-10-31', amountPaise: 10 }), exp({ id: 'e3', date: '2026-09-30', amountPaise: 100 })],
    })
    const f = financeSummary(s, period, TZ)
    expect(f.receivedPaise).toBe(101)
    expect(f.paymentsCount).toBe(2)
    expect(f.invoicedPaise).toBe(11)
    expect(f.invoicesCount).toBe(2)
    expect(f.expensesPaise).toBe(11)
    expect(f.netCashPaise).toBe(90)
    expect(f.receivedByMethod).toEqual({ cash: 101 })
  })
})

describe('metrics: financeSeries', () => {
  const TZ = 'Asia/Kolkata'
  it('uses month buckets across a year boundary with keys in order', () => {
    const r = financeSeries(snap({}), { start: '2026-11-15', end: '2027-02-10' }, TZ)
    expect(r.granularity).toBe('month')
    expect(r.points.map((p) => p.key)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
  it('switches to day buckets at 62 days and month at 63', () => {
    expect(financeSeries(snap({}), { start: '2026-01-01', end: '2026-03-03' }, TZ).granularity).toBe('day') // 62 days
    expect(financeSeries(snap({}), { start: '2026-01-01', end: '2026-03-04' }, TZ).granularity).toBe('month') // 63 days
  })
  it('day series includes both ends and drops out-of-period records', () => {
    const s = snap({
      payments: [pay({ id: 'p1', receivedAt: '2026-10-27T18:30:00.000Z', amountPaise: 5 }), pay({ id: 'p2', receivedAt: '2026-10-29T18:29:00.000Z', amountPaise: 7 }), pay({ id: 'p3', receivedAt: '2026-10-29T18:30:00.000Z', amountPaise: 9 })],
      attendance: [att({ id: 'a1', checkInAt: '2026-10-28T04:00:00.000Z' })],
      memberships: [ms({ id: 'ms1', createdAt: '2026-10-28T04:00:00.000Z' }), ms({ id: 'ms2', createdAt: '2026-10-29T04:00:00.000Z', renewalOfId: 'ms1' })],
    })
    const r = financeSeries(s, { start: '2026-10-28', end: '2026-10-29' }, TZ)
    expect(r.granularity).toBe('day')
    expect(r.points.map((p) => [p.key, p.received, p.attendance, p.newMemberships, p.renewals])).toEqual([
      ['2026-10-28', 5, 1, 1, 0],
      ['2026-10-29', 7, 0, 0, 1],
    ])
  })
  it('month series only counts records within the exact period even inside a partially-covered month', () => {
    const s = snap({ expenses: [exp({ id: 'e1', date: '2026-11-10', amountPaise: 1 }), exp({ id: 'e2', date: '2026-11-20', amountPaise: 10 })] })
    const r = financeSeries(s, { start: '2026-11-15', end: '2027-02-10' }, TZ)
    expect(r.points[0].expenses).toBe(10)
  })
})

describe('metrics: dashboardMetrics', () => {
  const TZ = 'Asia/Kolkata'
  const today = '2026-10-28'
  it('expiredRecently window is ≤30 days, outstanding excludes archived members', () => {
    const s = snap({
      members: [member({ id: 'm30' }), member({ id: 'm31' }), member({ id: 'arch', status: 'archived' }), member({ id: 'cur' })],
      memberships: [
        ms({ id: 'x30', memberId: 'm30', startDate: '2026-09-01', endDate: '2026-09-28' }), // 30 days ago
        ms({ id: 'x31', memberId: 'm31', startDate: '2026-09-01', endDate: '2026-09-27' }), // 31 days ago
        ms({ id: 'xa', memberId: 'arch', startDate: '2026-10-01', endDate: '2026-10-31' }),
        ms({ id: 'xc', memberId: 'cur', startDate: '2026-10-01', endDate: '2026-10-31' }),
      ],
      invoices: [inv({ id: 'ia', memberId: 'arch', totalPaise: 5000 }), inv({ id: 'ic', memberId: 'cur', totalPaise: 7000 }), inv({ id: 'icredit', memberId: 'm31', totalPaise: 100 })],
      payments: [pay({ id: 'pc', memberId: 'm31', invoiceId: undefined, amountPaise: 500 })],
    })
    const d = dashboardMetrics(s, today, TZ)
    expect(d.totalMembers).toBe(3)
    expect(d.activeMembers).toBe(1)
    expect(d.expiringSoon.map((r) => r.member.id)).toEqual(['cur'])
    expect(d.expiredRecently.map((r) => r.member.id)).toEqual(['m30'])
    expect(d.outstandingPaise).toBe(7000)
    expect(d.membersWithBalance).toBe(1)
  })
  it('attendanceToday is evaluated in the gym timezone', () => {
    const s = snap({ members: [member({})], attendance: [att({ id: 'late', checkInAt: '2026-10-27T23:30:00.000Z' }), att({ id: 'early', checkInAt: '2026-10-27T18:00:00.000Z', checkOutAt: '2026-10-27T19:00:00.000Z' })] })
    expect(dashboardMetrics(s, '2026-10-28', TZ).attendanceToday).toBe(1)
    expect(dashboardMetrics(s, '2026-10-27', TZ).attendanceToday).toBe(1)
    expect(dashboardMetrics(s, '2026-10-27', 'UTC').attendanceToday).toBe(2)
    expect(dashboardMetrics(s, '2026-10-28', TZ).checkedInNow).toBe(1)
  })
  it('memberRows lastVisitAt is the max check-in instant', () => {
    const s = snap({ members: [member({})], attendance: [att({ id: 'a', checkInAt: '2026-10-01T04:00:00.000Z' }), att({ id: 'b', checkInAt: '2026-10-05T04:00:00.000Z' }), att({ id: 'c', checkInAt: '2026-10-03T04:00:00.000Z' })] })
    expect(memberRows(s, today)[0].lastVisitAt).toBe('2026-10-05T04:00:00.000Z')
  })
})

describe('metrics: periodPreset', () => {
  it('month on the 1st is a single-day period; year on 1 Jan likewise', () => {
    expect(periodPreset('month', '2026-10-01')).toEqual({ start: '2026-10-01', end: '2026-10-01' })
    expect(periodPreset('year', '2026-01-01')).toEqual({ start: '2026-01-01', end: '2026-01-01' })
    expect(periodPreset('7d', '2026-01-03')).toEqual({ start: '2025-12-28', end: '2026-01-03' })
    expect(periodPreset('30d', '2026-03-01')).toEqual({ start: '2026-01-31', end: '2026-03-01' })
    expect(periodPreset('90d', '2026-10-28')).toEqual({ start: '2026-07-31', end: '2026-10-28' })
  })
})

// ---------------------------------------------------------------------------
// 6. CSV
// ---------------------------------------------------------------------------
describe('csv', () => {
  it('neutralises tab/CR-led cells and quotes when needed', () => {
    expect(csvCell('\tx')).toBe("'\tx")
    expect(csvCell('\rx')).toBe('"\'\rx"')
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"')
    expect(csvCell(true)).toBe('true')
    expect(csvCell(false)).toBe('false')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(12.5)).toBe('12.5')
    expect(csvCell(undefined)).toBe('')
  })
  it('plain negative numbers stay numeric; anything else formula-like is escaped', () => {
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell('-500.00')).toBe('-500.00')
    expect(csvCell('-5+3')).toBe("'-5+3")
    expect(csvCell('+91 98200')).toBe("'+91 98200")
  })
  it('toCsv starts with a BOM, joins with CRLF and ends with CRLF', () => {
    const out = toCsv(['a', 'b'], [[1, 'x'], [2, 'y']])
    expect(out.charCodeAt(0)).toBe(0xfeff)
    expect(out.slice(1)).toBe('a,b\r\n1,x\r\n2,y\r\n')
    expect(toCsv([], [])).toBe('﻿\r\n')
  })
})

// ---------------------------------------------------------------------------
// 7. Validation
// ---------------------------------------------------------------------------
describe('validation: phoneSchema', () => {
  const ok = (v: string) => phoneSchema.safeParse(v).success
  it('accepts + and spaces, 8 and 15 digits, rejects 7 and 16 digits', () => {
    expect(ok('+91 98765 43210')).toBe(true)
    expect(ok(' +91 98765 43210 ')).toBe(true)
    expect(ok('12345678')).toBe(true)
    expect(ok('123456789012345')).toBe(true)
    expect(ok('1234567')).toBe(false)
    expect(ok('1234567890123456')).toBe(false)
    expect(ok('+')).toBe(false)
    expect(ok('')).toBe(false)
    expect(ok('abcdefgh')).toBe(false)
    expect(ok('(022) 2345-6789')).toBe(true) // landline style with a leading parenthesis
  })
  it('normalizePhone keeps the last 10 digits', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210')
    expect(normalizePhone('98765')).toBe('98765')
  })
})

describe('validation: optionalEmail', () => {
  const ok = (v: unknown) => optionalEmail.safeParse(v).success
  it('requires a dotted domain and treats blank as undefined', () => {
    expect(ok('a@b')).toBe(false)
    expect(ok('a@b.co')).toBe(true)
    expect(ok('')).toBe(true)
    expect(ok('   ')).toBe(true)
    expect(optionalEmail.parse('  ')).toBeUndefined()
    expect(ok(undefined)).toBe(true)
  })
})

describe('validation: settingsForm', () => {
  const base = { gymName: 'G', address: '', phone: '', email: '', timezone: 'Asia/Kolkata', invoicePrefix: 'INV', invoiceFooter: '', gstin: '' }
  it('invoicePrefix allows letters, digits and dashes only', () => {
    expect(settingsForm.safeParse({ ...base, invoicePrefix: 'GYM-2026' }).success).toBe(true)
    expect(settingsForm.safeParse({ ...base, invoicePrefix: 'INV_1' }).success).toBe(false)
    expect(settingsForm.safeParse({ ...base, invoicePrefix: 'INV 1' }).success).toBe(false)
    expect(settingsForm.safeParse({ ...base, invoicePrefix: '' }).success).toBe(false)
    expect(settingsForm.safeParse({ ...base, invoicePrefix: 'ABCDEFGHIJK' }).success).toBe(false)
  })
  it('a prefix made only of dashes is accepted (cosmetic: numbers become "--00001")', () => {
    expect(settingsForm.safeParse({ ...base, invoicePrefix: '-' }).success).toBe(true)
  })
  it('blank phone/email allowed, bad timezone rejected', () => {
    expect(settingsForm.safeParse(base).success).toBe(true)
    expect(settingsForm.parse(base).email).toBe('')
    expect(settingsForm.safeParse({ ...base, timezone: 'Mars/Olympus' }).success).toBe(false)
    expect(settingsForm.safeParse({ ...base, phone: '+91 98765 43210' }).success).toBe(true)
    expect(settingsForm.safeParse({ ...base, phone: 'abc' }).success).toBe(false)
  })
})

describe('validation: followUpForm', () => {
  const base = { type: 'other', memberId: '', leadName: '', leadPhone: '', leadEmail: '', dueDate: '2026-10-28', assignee: '', note: '' }
  it('"other" needs neither member nor lead; expiry/payment need a member; lead needs a name', () => {
    expect(followUpForm.safeParse(base).success).toBe(true)
    expect(followUpForm.safeParse({ ...base, type: 'expiry' }).success).toBe(false)
    expect(followUpForm.safeParse({ ...base, type: 'payment' }).success).toBe(false)
    expect(followUpForm.safeParse({ ...base, type: 'payment', memberId: 'm' }).success).toBe(true)
    expect(followUpForm.safeParse({ ...base, type: 'lead' }).success).toBe(false)
    expect(followUpForm.safeParse({ ...base, type: 'lead', leadName: 'Tara' }).success).toBe(true)
    expect(followUpForm.safeParse({ ...base, dueDate: '2026-02-30' }).success).toBe(false)
  })
})

describe('validation: scheduleForm', () => {
  const base = { weekday: '1', startTime: '09:00', endTime: '10:00', label: 'Morning' }
  it('rejects end == start and end < start', () => {
    expect(scheduleForm.safeParse(base).success).toBe(true)
    expect(scheduleForm.safeParse({ ...base, endTime: '09:00' }).success).toBe(false)
    expect(scheduleForm.safeParse({ ...base, endTime: '08:59' }).success).toBe(false)
    expect(scheduleForm.safeParse({ ...base, weekday: '7' }).success).toBe(false)
  })
  it('rejects clock values that are not real times of day', () => {
    // BUG (minor, validation.ts:126-127): the regex /^\d{2}:\d{2}$/ accepts "25:00" and "09:60".
    // Fix: use /^([01]\d|2[0-3]):[0-5]\d$/ (or validate toMinutes() < 1440 and minutes < 60).
    expect(scheduleForm.safeParse({ ...base, endTime: '25:00' }).success).toBe(false)
    expect(scheduleForm.safeParse({ ...base, endTime: '09:60' }).success).toBe(false)
  })
  it('toMinutes', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('23:59')).toBe(1439)
  })
})

describe('validation: rupeesInput', () => {
  it('allowZero turns "" and " " into 0; otherwise blank is an error', () => {
    expect(rupeesInput({ allowZero: true }).parse('')).toBe(0)
    expect(rupeesInput({ allowZero: true }).parse(' ')).toBe(0)
    expect(rupeesInput({ allowZero: true }).parse('0')).toBe(0)
    expect(rupeesInput().safeParse('').success).toBe(false)
    expect(rupeesInput().safeParse('0').success).toBe(false)
    expect(rupeesInput().safeParse('-1').success).toBe(false)
    expect(rupeesInput({ min: 500 }).safeParse('4.99').success).toBe(false)
    expect(rupeesInput({ min: 500 }).parse('5')).toBe(500)
  })
  it('planForm coerces durationValue and rejects 0 / fractional', () => {
    const base = { name: 'Monthly', durationValue: '1', durationUnit: 'months', price: '1500', description: '' }
    expect(planForm.parse(base).durationValue).toBe(1)
    expect(planForm.safeParse({ ...base, durationValue: '0' }).success).toBe(false)
    expect(planForm.safeParse({ ...base, durationValue: '1.5' }).success).toBe(false)
    expect(planForm.safeParse({ ...base, durationValue: '' }).success).toBe(false)
    expect(planForm.parse({ ...base, price: '' }).price).toBe(0)
  })
})
