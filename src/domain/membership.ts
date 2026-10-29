import type { Membership, ISODate, Invoice, Payment, Adjustment, Paise } from './types'
import { compareDates, diffDays } from './dates'

export type MembershipState = 'upcoming' | 'active' | 'expiring' | 'expired' | 'cancelled'

/** Status derived purely from dates versus the gym's current date. */
export function membershipState(m: Membership, today: ISODate, expiringWithinDays = 7): MembershipState {
  if (m.cancelledAt) return 'cancelled'
  if (compareDates(m.startDate, today) > 0) return 'upcoming'
  if (compareDates(m.endDate, today) < 0) return 'expired'
  const daysLeft = diffDays(today, m.endDate)
  if (daysLeft <= expiringWithinDays) return 'expiring'
  return 'active'
}

export function isMembershipCurrent(m: Membership, today: ISODate): boolean {
  const s = membershipState(m, today)
  return s === 'active' || s === 'expiring'
}

export function daysRemaining(m: Membership, today: ISODate): number {
  return diffDays(today, m.endDate)
}

/** The membership that covers today, or the most recent one otherwise. */
export function pickCurrentMembership(all: Membership[], today: ISODate): Membership | undefined {
  const list = all.filter((m) => !m.cancelledAt)
  const current = list.filter((m) => isMembershipCurrent(m, today)).sort((a, b) => compareDates(b.endDate, a.endDate))[0]
  if (current) return current
  const upcoming = list.filter((m) => membershipState(m, today) === 'upcoming').sort((a, b) => compareDates(a.startDate, b.startDate))[0]
  if (upcoming) return upcoming
  return [...list].sort((a, b) => compareDates(b.endDate, a.endDate))[0]
}

export function latestEndDate(list: Membership[]): ISODate | undefined {
  return list.filter((m) => !m.cancelledAt).sort((a, b) => compareDates(b.endDate, a.endDate))[0]?.endDate
}

export interface InvoiceBalance {
  totalPaise: Paise
  adjustmentsPaise: Paise
  duePaise: Paise
  paidPaise: Paise
  balancePaise: Paise
  status: 'void' | 'paid' | 'partial' | 'unpaid' | 'credit'
}

/** Money derived from records only; never from stored labels. */
export function invoiceBalance(invoice: Invoice, payments: Payment[], adjustments: Adjustment[]): InvoiceBalance {
  const adjustmentsPaise = adjustments.filter((a) => a.invoiceId === invoice.id).reduce((s, a) => s + a.amountPaise, 0)
  const paidPaise = payments
    .filter((p) => p.invoiceId === invoice.id && p.status === 'recorded')
    .reduce((s, p) => s + p.amountPaise, 0)
  const duePaise = invoice.status === 'void' ? 0 : invoice.totalPaise + adjustmentsPaise
  const balancePaise = duePaise - paidPaise
  let status: InvoiceBalance['status']
  if (invoice.status === 'void') status = 'void'
  else if (balancePaise < 0) status = 'credit'
  else if (balancePaise === 0) status = 'paid'
  else if (paidPaise > 0) status = 'partial'
  else status = 'unpaid'
  return { totalPaise: invoice.totalPaise, adjustmentsPaise, duePaise, paidPaise, balancePaise, status }
}

export interface MemberBalance {
  invoicedPaise: Paise
  paidPaise: Paise
  balancePaise: Paise
}

/** Outstanding for a member: all live invoices (with adjustments) minus all recorded payments. */
export function memberBalance(invoices: Invoice[], payments: Payment[], adjustments: Adjustment[]): MemberBalance {
  const invoicedPaise = invoices.reduce((s, inv) => s + invoiceBalance(inv, payments, adjustments).duePaise, 0)
  const paidPaise = payments.filter((p) => p.status === 'recorded').reduce((s, p) => s + p.amountPaise, 0)
  return { invoicedPaise, paidPaise, balancePaise: invoicedPaise - paidPaise }
}
