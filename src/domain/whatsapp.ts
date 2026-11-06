import type { ISODate, Paise } from './types'
import { diffDays, formatDate } from './dates'
import { formatINRCompact } from './money'

/**
 * WhatsApp messages the front desk can send to a member. GymBook only writes the text and opens
 * WhatsApp with it; the person at the desk presses send there.
 *
 * Emoji are single code points on purpose (no variation selectors or joined sequences), the plainest
 * form for older phones. `*text*` is WhatsApp's own bold.
 */

/** Digits for a WhatsApp link. A bare 10-digit number is taken as Indian; a "+" number is kept as typed. */
export function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (phone.trim().startsWith('+')) return digits
  return digits.length === 10 ? `91${digits}` : digits
}

/**
 * Link that opens a WhatsApp chat with the text filled in.
 * It must point at api.whatsapp.com directly. The short wa.me form answers with a redirect that
 * replaces every emoji in the text with U+FFFD, so the message arrives full of "�" boxes
 * (seen in a real chat and in the redirect's Location header, 2026-11-06).
 */
export function whatsappUrl(phone: string, text: string): string {
  return `https://api.whatsapp.com/send?phone=${toWaNumber(phone)}&text=${encodeURIComponent(text)}`
}

/** Sample records are labelled "Sample …" in the app; the label does not belong in a greeting. */
const firstLine = (gymName: string) => `💪 *${gymName.trim()}*`
const greeting = (memberName: string) => `Hi ${memberName.replace(/^Sample\s+/i, '').trim()} 👋`
const signOff = (gymPhone?: string) => ['Thank you 🙏', gymPhone?.trim() ? `📞 ${gymPhone.trim()}` : null].filter(Boolean).join('\n')

/** "30 days left", "ends tomorrow", "ends today" or "expired" for a plan's last day. */
export function daysLeftLabel(endDate: ISODate, today: ISODate): string {
  const n = diffDays(today, endDate)
  if (n < 0) return 'expired'
  if (n === 0) return 'ends today'
  if (n === 1) return 'ends tomorrow'
  return `${n} days left`
}

export interface PlanFacts {
  planName: string
  startDate: ISODate
  endDate: ISODate
}

export interface MoneyFacts {
  invoiceNumber: string
  /** Invoice total after discount and adjustments. */
  duePaise: Paise
  paidPaise: Paise
  /** Positive: still owed. Negative: credit with the gym. */
  balancePaise: Paise
}

function planLines(plan: PlanFacts, today: ISODate): string[] {
  const started = diffDays(plan.startDate, today) >= 0
  return [
    `📋 *Plan:* ${plan.planName}`,
    `📅 *${started ? 'From' : 'Starts'}:* ${formatDate(plan.startDate)}`,
    `⏳ *Valid till:* ${formatDate(plan.endDate)}${started ? ` (${daysLeftLabel(plan.endDate, today)})` : ''}`,
  ]
}

/** `withBalance` adds what is still owed; the welcome and membership messages leave it out on purpose. */
function moneyLines(money: MoneyFacts, withBalance: boolean): string[] {
  const lines = [`🧾 *Invoice:* ${money.invoiceNumber}`, `💰 *Amount:* ${formatINRCompact(money.duePaise)}`]
  if (money.paidPaise > 0) lines.push(`✅ *Paid:* ${formatINRCompact(money.paidPaise)}${money.balancePaise === 0 ? ' (fully paid)' : ''}`)
  if (withBalance && money.balancePaise > 0) lines.push(`🔔 *Balance due:* ${formatINRCompact(money.balancePaise)}`)
  if (money.balancePaise < 0) lines.push(`💳 *Credit with us:* ${formatINRCompact(-money.balancePaise)}`)
  return lines
}

const join = (blocks: (string | string[] | null | undefined)[]) => blocks.flatMap((b) => (!b || b.length === 0 ? [] : [typeof b === 'string' ? b : b.join('\n')])).join('\n\n')

/**
 * The member's name, plan, validity and what was paid. With `welcome` it opens as a welcome note for
 * someone who was just added; without a plan it is a short welcome.
 * It carries neither the member ID nor the balance still due (owner's choice); the invoice message shows the balance.
 */
export function membershipMessage(o: { gymName: string; gymPhone?: string; memberName: string; welcome?: boolean; plan?: PlanFacts; money?: MoneyFacts; today: ISODate }): string {
  const intro = [greeting(o.memberName), o.welcome ? `Welcome to ${o.gymName.trim()}! 🎉` : o.plan ? 'Here are your membership details:' : 'Thank you for being with us.']
  return join([firstLine(o.gymName), intro, o.plan ? planLines(o.plan, o.today) : null, o.money ? moneyLines(o.money, false) : null, signOff(o.gymPhone)])
}

/** The invoice as text: what was billed, the discount, and what is paid and still due. A link cannot carry the PDF itself. */
export function invoiceMessage(o: { gymName: string; gymPhone?: string; memberName: string; issueDate: ISODate; lines: { description: string; amountPaise: Paise }[]; discountPaise: Paise; adjustmentsPaise: Paise; money: MoneyFacts }): string {
  const items = o.lines.map((l) => `▪ ${l.description}: ${formatINRCompact(l.amountPaise)}`)
  if (o.discountPaise > 0) items.push(`🎁 *Discount:* -${formatINRCompact(o.discountPaise)}`)
  if (o.adjustmentsPaise !== 0) items.push(`📝 *Adjustment:* ${o.adjustmentsPaise > 0 ? '+' : '-'}${formatINRCompact(Math.abs(o.adjustmentsPaise))}`)
  const [invoiceLine, ...rest] = moneyLines(o.money, true)
  return join([firstLine(o.gymName), [greeting(o.memberName), 'Here is your invoice:'], [invoiceLine, `📅 *Date:* ${formatDate(o.issueDate)}`], items, rest, signOff(o.gymPhone)])
}

/** A renewal reminder for a plan that is about to end, or has just ended. */
export function expiryMessage(o: { gymName: string; gymPhone?: string; memberName: string; planName: string; endDate: ISODate; today: ISODate }): string {
  const n = diffDays(o.today, o.endDate)
  const when = n < 0 ? `ended on ${formatDate(o.endDate)}` : n === 0 ? 'ends *today*' : n === 1 ? 'ends *tomorrow*' : `ends on *${formatDate(o.endDate)}* (${n} days left)`
  return join([firstLine(o.gymName), [greeting(o.memberName), `⏳ Your *${o.planName}* membership ${when}.`], `🔁 Renew at the desk to keep your training going.`, signOff(o.gymPhone)])
}
