import type { Snapshot } from '@/data/snapshot'
import { groupBy } from '@/data/snapshot'
import type { ISODate, Paise, Member, Membership, Session } from './types'
import { isMembershipCurrent, membershipState, memberBalance, pickCurrentMembership } from './membership'
import { compareDates, diffDays, instantToDateInTz, eachDay, monthKey, addDays, daysInMonth } from './dates'

export interface Period {
  start: ISODate
  end: ISODate
}

export interface MemberRow {
  member: Member
  current?: Membership
  state?: ReturnType<typeof membershipState>
  balancePaise: Paise
  lastVisitAt?: string
}

/** Per-member derived facts used by lists, dashboard and reports. */
export function memberRows(snap: Snapshot, today: ISODate): MemberRow[] {
  const msByMember = groupBy(snap.memberships, (m) => m.memberId)
  const invByMember = groupBy(snap.invoices, (i) => i.memberId)
  const payByMember = groupBy(snap.payments, (p) => p.memberId)
  const adjByMember = groupBy(snap.adjustments, (a) => a.memberId)
  const attByMember = groupBy(snap.attendance, (a) => a.memberId)
  return snap.members.map((member) => {
    const list = msByMember.get(member.id) ?? []
    const current = pickCurrentMembership(list, today)
    const bal = memberBalance(invByMember.get(member.id) ?? [], payByMember.get(member.id) ?? [], adjByMember.get(member.id) ?? [])
    const visits = attByMember.get(member.id) ?? []
    const lastVisitAt = visits.reduce<string | undefined>((max, v) => (!max || v.checkInAt > max ? v.checkInAt : max), undefined)
    return { member, current, state: current ? membershipState(current, today) : undefined, balancePaise: bal.balancePaise, lastVisitAt }
  })
}

export interface TodayOps {
  sessionsToday: { session: Session; memberName: string; trainerName: string }[]
  openIncidents: number
  highIncidents: number
  outOfOrder: number
  needsService: number
}

export function todayOps(snap: Snapshot, today: ISODate, timezone: string): TodayOps {
  const memberName = new Map(snap.members.map((m) => [m.id, m.name]))
  const trainerName = new Map(snap.trainers.map((t) => [t.id, t.name]))
  const sessionsToday = snap.sessions
    .filter((s) => instantToDateInTz(s.startAt, timezone) === today)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((session) => ({ session, memberName: memberName.get(session.memberId) ?? 'Unknown', trainerName: trainerName.get(session.trainerId) ?? 'Unknown' }))
  const open = snap.incidents.filter((i) => i.status !== 'resolved')
  const live = snap.equipment.filter((e) => !e.archived)
  return {
    sessionsToday,
    openIncidents: open.length,
    highIncidents: open.filter((i) => i.severity === 'high').length,
    outOfOrder: live.filter((e) => e.status === 'out_of_order').length,
    needsService: live.filter((e) => e.status === 'needs_service').length,
  }
}

/** Month-over-month comparison: this calendar month so far vs. the same number of days last month. */
export function monthComparison(snap: Snapshot, today: ISODate, timezone: string): { received: [Paise, Paise]; newMembers: [number, number]; visits: [number, number] } {
  const thisStart = today.slice(0, 7) + '-01'
  const dayOfMonth = Number(today.slice(8, 10))
  const [yy, mm] = thisStart.split('-').map(Number)
  const y = mm === 1 ? yy - 1 : yy
  const m = mm === 1 ? 12 : mm - 1
  const lastStart = `${y}-${String(m).padStart(2, '0')}-01`
  const lastEnd = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(dayOfMonth, daysInMonth(y, m))).padStart(2, '0')}`
  const within = (d: ISODate, start: ISODate, end: ISODate) => compareDates(d, start) >= 0 && compareDates(d, end) <= 0
  const sum = (start: ISODate, end: ISODate) => snap.payments.filter((p) => p.status === 'recorded' && within(instantToDateInTz(p.receivedAt, timezone), start, end)).reduce((s, p) => s + p.amountPaise, 0)
  const joined = (start: ISODate, end: ISODate) => snap.members.filter((x) => within(x.joiningDate, start, end)).length
  const visits = (start: ISODate, end: ISODate) => snap.attendance.filter((a) => within(instantToDateInTz(a.checkInAt, timezone), start, end)).length
  return { received: [sum(thisStart, today), sum(lastStart, lastEnd)], newMembers: [joined(thisStart, today), joined(lastStart, lastEnd)], visits: [visits(thisStart, today), visits(lastStart, lastEnd)] }
}

export interface DashboardMetrics {
  totalMembers: number
  activeMembers: number
  expiringSoon: MemberRow[]
  expiredRecently: MemberRow[]
  attendanceToday: number
  checkedInNow: number
  outstandingPaise: number
  membersWithBalance: number
}

export function dashboardMetrics(snap: Snapshot, today: ISODate, timezone: string): DashboardMetrics {
  const rows = memberRows(snap, today).filter((r) => r.member.status !== 'archived')
  const activeMembers = rows.filter((r) => r.current && isMembershipCurrent(r.current, today)).length
  const expiringSoon = rows
    .filter((r) => r.current && r.state === 'expiring')
    .sort((a, b) => compareDates(a.current!.endDate, b.current!.endDate))
  const expiredRecently = rows
    .filter((r) => r.current && r.state === 'expired' && diffDays(r.current.endDate, today) <= 30)
    .sort((a, b) => compareDates(b.current!.endDate, a.current!.endDate))
  const attendanceToday = snap.attendance.filter((a) => instantToDateInTz(a.checkInAt, timezone) === today).length
  const checkedInNow = snap.attendance.filter((a) => a.checkOutAt === null).length
  const withBalance = rows.filter((r) => r.balancePaise > 0)
  return {
    totalMembers: rows.length,
    activeMembers,
    expiringSoon,
    expiredRecently,
    attendanceToday,
    checkedInNow,
    outstandingPaise: withBalance.reduce((s, r) => s + r.balancePaise, 0),
    membersWithBalance: withBalance.length,
  }
}

/** Outstanding across the gym: per non-archived member, invoices (+adjustments) minus every recorded payment, floored at zero. */
export function outstandingSummary(snap: Snapshot, today: ISODate): { totalPaise: Paise; members: number } {
  const rows = memberRows(snap, today).filter((r) => r.member.status !== 'archived' && r.balancePaise > 0)
  return { totalPaise: rows.reduce((s, r) => s + r.balancePaise, 0), members: rows.length }
}

export interface FinanceSummary {
  receivedPaise: Paise
  invoicedPaise: Paise
  adjustmentsPaise: Paise
  expensesPaise: Paise
  netCashPaise: Paise
  receivedByMethod: Record<string, Paise>
  expensesByCategory: Record<string, Paise>
  paymentsCount: number
  invoicesCount: number
  expensesCount: number
}

function inPeriod(date: ISODate, p: Period): boolean {
  return compareDates(date, p.start) >= 0 && compareDates(date, p.end) <= 0
}

/**
 * Cash received = recorded (non-void) payments by received date.
 * Invoiced = totals of issued (non-void) invoices by issue date.
 * These are different numbers on purpose: invoiced − received ≈ what is still owed.
 */
export function financeSummary(snap: Snapshot, period: Period, timezone: string): FinanceSummary {
  const payments = snap.payments.filter((p) => p.status === 'recorded' && inPeriod(instantToDateInTz(p.receivedAt, timezone), period))
  const invoices = snap.invoices.filter((i) => i.status === 'issued' && inPeriod(i.issueDate, period))
  const adjustments = snap.adjustments.filter((a) => inPeriod(instantToDateInTz(a.createdAt, timezone), period))
  const expenses = snap.expenses.filter((e) => inPeriod(e.date, period))
  const receivedByMethod: Record<string, Paise> = {}
  for (const p of payments) receivedByMethod[p.method] = (receivedByMethod[p.method] ?? 0) + p.amountPaise
  const expensesByCategory: Record<string, Paise> = {}
  for (const e of expenses) expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amountPaise
  const receivedPaise = payments.reduce((s, p) => s + p.amountPaise, 0)
  const expensesPaise = expenses.reduce((s, e) => s + e.amountPaise, 0)
  return {
    receivedPaise,
    invoicedPaise: invoices.reduce((s, i) => s + i.totalPaise, 0),
    adjustmentsPaise: adjustments.reduce((s, a) => s + a.amountPaise, 0),
    expensesPaise,
    netCashPaise: receivedPaise - expensesPaise,
    receivedByMethod,
    expensesByCategory,
    paymentsCount: payments.length,
    invoicesCount: invoices.length,
    expensesCount: expenses.length,
  }
}

export interface SeriesPoint {
  key: string
  label: string
  received: Paise
  expenses: Paise
  attendance: number
  renewals: number
  newMemberships: number
}

/** Daily buckets for short periods, monthly for long ones. */
export function financeSeries(snap: Snapshot, period: Period, timezone: string): { points: SeriesPoint[]; granularity: 'day' | 'month' } {
  const days = diffDays(period.start, period.end) + 1
  const granularity: 'day' | 'month' = days > 62 ? 'month' : 'day'
  const bucket = (d: ISODate) => (granularity === 'day' ? d : monthKey(d))
  const map = new Map<string, SeriesPoint>()
  const keys: string[] = []
  if (granularity === 'day') {
    for (const d of eachDay(period.start, period.end)) keys.push(d)
  } else {
    let cur = period.start.slice(0, 7) + '-01'
    while (compareDates(cur, period.end) <= 0) {
      keys.push(monthKey(cur))
      const [y, m] = cur.split('-').map(Number)
      cur = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
    }
  }
  for (const k of keys) map.set(k, { key: k, label: k, received: 0, expenses: 0, attendance: 0, renewals: 0, newMemberships: 0 })
  const add = (date: ISODate, fn: (p: SeriesPoint) => void) => {
    if (!inPeriod(date, period)) return
    const p = map.get(bucket(date))
    if (p) fn(p)
  }
  for (const p of snap.payments) if (p.status === 'recorded') add(instantToDateInTz(p.receivedAt, timezone), (pt) => (pt.received += p.amountPaise))
  for (const e of snap.expenses) add(e.date, (pt) => (pt.expenses += e.amountPaise))
  for (const a of snap.attendance) add(instantToDateInTz(a.checkInAt, timezone), (pt) => (pt.attendance += 1))
  for (const m of snap.memberships) {
    const soldOn = instantToDateInTz(m.createdAt, timezone)
    add(soldOn, (pt) => (m.renewalOfId ? (pt.renewals += 1) : (pt.newMemberships += 1)))
  }
  return { points: keys.map((k) => map.get(k)!), granularity }
}

export function periodPreset(name: 'today' | '7d' | '30d' | 'month' | '90d' | 'year', today: ISODate): Period {
  switch (name) {
    case 'today':
      return { start: today, end: today }
    case '7d':
      return { start: addDays(today, -6), end: today }
    case '30d':
      return { start: addDays(today, -29), end: today }
    case 'month':
      return { start: today.slice(0, 7) + '-01', end: today }
    case '90d':
      return { start: addDays(today, -89), end: today }
    case 'year':
      return { start: today.slice(0, 4) + '-01-01', end: today }
  }
}
