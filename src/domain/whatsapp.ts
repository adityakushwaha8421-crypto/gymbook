import type { ISODate, Paise } from './types'
import { diffDays, formatDate, partsOf } from './dates'
import { formatINRCompact } from './money'

/**
 * WhatsApp messages the front desk can send to a member. GymBook only writes the text and opens
 * WhatsApp with it; the person at the desk presses send there.
 *
 * Emoji are single code points on purpose (no variation selectors or joined sequences), the plainest
 * form for older phones. `*text*` is WhatsApp's own bold.
 *
 * Every message exists in English and in Marathi. Only the gym's own words are translated: names,
 * plan names, invoice numbers and invoice line descriptions are sent as they are stored.
 */

export type MessageLang = 'en' | 'mr'
export const MESSAGE_LANGS: { value: MessageLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'mr', label: 'मराठी' },
]

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

const MR_MONTHS = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर']

/** "6 Nov 2026" in English, "6 नोव्हेंबर 2026" in Marathi. Digits stay Latin so they match the rupee amounts. */
function dateIn(lang: MessageLang, date: ISODate): string {
  if (lang === 'en') return formatDate(date)
  const { y, m, d } = partsOf(date)
  return `${d} ${MR_MONTHS[m - 1]} ${y}`
}

interface Words {
  greeting: (name: string) => string
  welcome: (gym: string) => string
  details: string
  thanksForStaying: string
  thanks: string
  plan: string
  from: string
  starts: string
  validTill: (date: string, left?: string) => string
  expired: string
  endsToday: string
  endsTomorrow: string
  daysLeft: (n: number) => string
  invoice: string
  amount: string
  paid: string
  fullyPaid: string
  balanceDue: string
  credit: string
  yourInvoice: string
  date: string
  discount: string
  adjustment: string
  /** The reminder sentence; `n` is days until the last day (negative once it has passed). */
  expiry: (plan: string, date: string, n: number) => string
  renew: string
}

const WORDS: Record<MessageLang, Words> = {
  en: {
    greeting: (name) => `Hi ${name} 👋`,
    welcome: (gym) => `Welcome to ${gym}! 🎉`,
    details: 'Here are your membership details:',
    thanksForStaying: 'Thank you for being with us.',
    thanks: 'Thank you 🙏',
    plan: 'Plan',
    from: 'From',
    starts: 'Starts',
    validTill: (date, left) => `⏳ *Valid till:* ${date}${left ? ` (${left})` : ''}`,
    expired: 'expired',
    endsToday: 'ends today',
    endsTomorrow: 'ends tomorrow',
    daysLeft: (n) => `${n} days left`,
    invoice: 'Invoice',
    amount: 'Amount',
    paid: 'Paid',
    fullyPaid: 'fully paid',
    balanceDue: 'Balance due',
    credit: 'Credit with us',
    yourInvoice: 'Here is your invoice:',
    date: 'Date',
    discount: 'Discount',
    adjustment: 'Adjustment',
    expiry: (plan, date, n) => `⏳ Your *${plan}* membership ${n < 0 ? `ended on ${date}` : n === 0 ? 'ends *today*' : n === 1 ? 'ends *tomorrow*' : `ends on *${date}* (${n} days left)`}.`,
    renew: '🔁 Renew at the desk to keep your training going.',
  },
  mr: {
    greeting: (name) => `नमस्कार ${name} 👋`,
    welcome: (gym) => `${gym} मध्ये आपले स्वागत आहे! 🎉`,
    details: 'आपल्या सदस्यत्वाची माहिती:',
    thanksForStaying: 'आमच्यासोबत असल्याबद्दल धन्यवाद.',
    thanks: 'धन्यवाद 🙏',
    plan: 'प्लॅन',
    from: 'सुरुवात',
    starts: 'सुरू होणार',
    validTill: (date, left) => `⏳ *वैधता:* ${date} पर्यंत${left ? ` (${left})` : ''}`,
    expired: 'मुदत संपली',
    endsToday: 'आज संपत आहे',
    endsTomorrow: 'उद्या संपत आहे',
    daysLeft: (n) => `${n} दिवस बाकी`,
    invoice: 'बिल क्रमांक',
    amount: 'रक्कम',
    paid: 'भरलेली रक्कम',
    fullyPaid: 'पूर्ण भरले',
    balanceDue: 'बाकी रक्कम',
    credit: 'आमच्याकडे जमा',
    yourInvoice: 'आपले बिल खालीलप्रमाणे:',
    date: 'तारीख',
    discount: 'सवलत',
    adjustment: 'समायोजन',
    expiry: (plan, date, n) => `⏳ आपले *${plan}* सदस्यत्व ${n < 0 ? `${date} रोजी संपले आहे` : n === 0 ? '*आज* संपत आहे' : n === 1 ? '*उद्या* संपत आहे' : `*${date}* रोजी संपत आहे (${n} दिवस बाकी)`}.`,
    renew: '🔁 व्यायाम सुरू ठेवण्यासाठी कृपया जिममध्ये येऊन नूतनीकरण करा.',
  },
}

const firstLine = (gymName: string) => `💪 *${gymName.trim()}*`
/** Sample records are labelled "Sample …" in the app; the label does not belong in a greeting. */
const greeting = (w: Words, memberName: string) => w.greeting(memberName.replace(/^Sample\s+/i, '').trim())
const signOff = (w: Words, gymPhone?: string) => [w.thanks, gymPhone?.trim() ? `📞 ${gymPhone.trim()}` : null].filter(Boolean).join('\n')

/** "30 days left", "ends tomorrow", "ends today" or "expired" for a plan's last day. */
export function daysLeftLabel(endDate: ISODate, today: ISODate, lang: MessageLang = 'en'): string {
  const w = WORDS[lang]
  const n = diffDays(today, endDate)
  if (n < 0) return w.expired
  if (n === 0) return w.endsToday
  if (n === 1) return w.endsTomorrow
  return w.daysLeft(n)
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

function planLines(lang: MessageLang, plan: PlanFacts, today: ISODate): string[] {
  const w = WORDS[lang]
  const started = diffDays(plan.startDate, today) >= 0
  return [
    `📋 *${w.plan}:* ${plan.planName}`,
    `📅 *${started ? w.from : w.starts}:* ${dateIn(lang, plan.startDate)}`,
    w.validTill(dateIn(lang, plan.endDate), started ? daysLeftLabel(plan.endDate, today, lang) : undefined),
  ]
}

/** `withBalance` adds what is still owed; the welcome and membership messages leave it out on purpose. */
function moneyLines(w: Words, money: MoneyFacts, withBalance: boolean): string[] {
  const lines = [`🧾 *${w.invoice}:* ${money.invoiceNumber}`, `💰 *${w.amount}:* ${formatINRCompact(money.duePaise)}`]
  if (money.paidPaise > 0) lines.push(`✅ *${w.paid}:* ${formatINRCompact(money.paidPaise)}${money.balancePaise === 0 ? ` (${w.fullyPaid})` : ''}`)
  if (withBalance && money.balancePaise > 0) lines.push(`🔔 *${w.balanceDue}:* ${formatINRCompact(money.balancePaise)}`)
  if (money.balancePaise < 0) lines.push(`💳 *${w.credit}:* ${formatINRCompact(-money.balancePaise)}`)
  return lines
}

const join = (blocks: (string | string[] | null | undefined)[]) => blocks.flatMap((b) => (!b || b.length === 0 ? [] : [typeof b === 'string' ? b : b.join('\n')])).join('\n\n')

/**
 * The member's name, plan, validity and what was paid. With `welcome` it opens as a welcome note for
 * someone who was just added; without a plan it is a short welcome.
 * It carries neither the member ID nor the balance still due (owner's choice); the invoice message shows the balance.
 */
export function membershipMessage(o: { gymName: string; gymPhone?: string; memberName: string; welcome?: boolean; plan?: PlanFacts; money?: MoneyFacts; today: ISODate; lang?: MessageLang }): string {
  const lang = o.lang ?? 'en'
  const w = WORDS[lang]
  const intro = [greeting(w, o.memberName), o.welcome ? w.welcome(o.gymName.trim()) : o.plan ? w.details : w.thanksForStaying]
  return join([firstLine(o.gymName), intro, o.plan ? planLines(lang, o.plan, o.today) : null, o.money ? moneyLines(w, o.money, false) : null, signOff(w, o.gymPhone)])
}

/** The invoice as text: what was billed, the discount, and what is paid and still due. A link cannot carry the PDF itself. */
export function invoiceMessage(o: { gymName: string; gymPhone?: string; memberName: string; issueDate: ISODate; lines: { description: string; amountPaise: Paise }[]; discountPaise: Paise; adjustmentsPaise: Paise; money: MoneyFacts; lang?: MessageLang }): string {
  const lang = o.lang ?? 'en'
  const w = WORDS[lang]
  const items = o.lines.map((l) => `▪ ${l.description}: ${formatINRCompact(l.amountPaise)}`)
  if (o.discountPaise > 0) items.push(`🎁 *${w.discount}:* -${formatINRCompact(o.discountPaise)}`)
  if (o.adjustmentsPaise !== 0) items.push(`📝 *${w.adjustment}:* ${o.adjustmentsPaise > 0 ? '+' : '-'}${formatINRCompact(Math.abs(o.adjustmentsPaise))}`)
  const [invoiceLine, ...rest] = moneyLines(w, o.money, true)
  return join([firstLine(o.gymName), [greeting(w, o.memberName), w.yourInvoice], [invoiceLine, `📅 *${w.date}:* ${dateIn(lang, o.issueDate)}`], items, rest, signOff(w, o.gymPhone)])
}

/** A renewal reminder for a plan that is about to end, or has just ended. */
export function expiryMessage(o: { gymName: string; gymPhone?: string; memberName: string; planName: string; endDate: ISODate; today: ISODate; lang?: MessageLang }): string {
  const lang = o.lang ?? 'en'
  const w = WORDS[lang]
  return join([firstLine(o.gymName), [greeting(w, o.memberName), w.expiry(o.planName, dateIn(lang, o.endDate), diffDays(o.today, o.endDate))], w.renew, signOff(w, o.gymPhone)])
}
