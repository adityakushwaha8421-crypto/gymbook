import type { Paise } from './types'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Format integer paise as ₹ with two decimals (₹1,250.00). */
export function formatINR(paise: Paise): string {
  return inr.format(paise / 100)
}

/** Compact format that drops paise when they are zero (₹1,250). */
export function formatINRCompact(paise: Paise): string {
  if (paise % 100 === 0) return inrWhole.format(paise / 100)
  return inr.format(paise / 100)
}

/** Convert integer paise to a plain rupee string for form inputs ("1250.50"). */
export function paiseToInput(paise: Paise | undefined | null): string {
  if (paise === undefined || paise === null) return ''
  const abs = Math.abs(paise)
  const sign = paise < 0 ? '-' : ''
  const rupees = Math.floor(abs / 100)
  const rest = abs % 100
  return rest === 0 ? `${sign}${rupees}` : `${sign}${rupees}.${String(rest).padStart(2, '0')}`
}

/**
 * Parse a rupee amount typed by a person into integer paise.
 * Accepts "1250", "1,250.50", "₹ 1250". Returns null when invalid.
 */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  if (!/^-?\d*(\.\d{0,2})?$/.test(cleaned)) return null
  const negative = cleaned.startsWith('-')
  const [whole, frac = ''] = cleaned.replace('-', '').split('.')
  const rupees = whole === '' ? 0 : Number.parseInt(whole, 10)
  const paise = frac === '' ? 0 : Number.parseInt(frac.padEnd(2, '0'), 10)
  if (!Number.isSafeInteger(rupees)) return null
  const total = rupees * 100 + paise
  if (!Number.isSafeInteger(total)) return null
  if (total === 0) return 0
  return negative ? -total : total
}

export function sumPaise(values: Iterable<Paise>): Paise {
  let total = 0
  for (const v of values) total += v
  return total
}
