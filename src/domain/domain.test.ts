import { describe, it, expect } from 'vitest'
import { membershipEndDate, addMonths, todayInTz, instantToDateInTz, startOfDayInstant, diffDays } from './dates'
import { parseRupees, formatINR, paiseToInput } from './money'
import { csvCell, toCsv } from './csv'
import { invoiceBalance, membershipState, memberBalance } from './membership'
import type { Invoice, Payment, Adjustment, Membership } from './types'

describe('dates', () => {
  it('computes inclusive end dates for month plans', () => {
    expect(membershipEndDate('2026-01-15', 1, 'months')).toBe('2026-02-14')
    expect(membershipEndDate('2026-01-31', 1, 'months')).toBe('2026-02-27') // Feb has 28 days in 2026 → exclusive end 28 Feb → inclusive 27
    expect(membershipEndDate('2026-03-01', 30, 'days')).toBe('2026-03-30')
    expect(membershipEndDate('2026-12-01', 3, 'months')).toBe('2027-02-28')
  })
  it('clamps month arithmetic', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  })
  it('evaluates today in the gym timezone', () => {
    const instant = new Date('2026-10-27T20:30:00Z') // 02:00 IST on 28 Oct
    expect(todayInTz('Asia/Kolkata', instant)).toBe('2026-10-28')
    expect(todayInTz('America/New_York', instant)).toBe('2026-10-27')
    expect(instantToDateInTz('2026-10-27T20:30:00Z', 'Asia/Kolkata')).toBe('2026-10-28')
    expect(startOfDayInstant('2026-10-28', 'Asia/Kolkata')).toBe('2026-10-27T18:30:00.000Z')
    expect(diffDays('2026-10-28', '2026-11-04')).toBe(7)
  })
})

describe('money', () => {
  it('parses rupees into integer paise', () => {
    expect(parseRupees('1250')).toBe(125000)
    expect(parseRupees('1,250.50')).toBe(125050)
    expect(parseRupees('₹ 10.5')).toBe(1050)
    expect(parseRupees('0.1')).toBe(10)
    expect(parseRupees('abc')).toBeNull()
    expect(parseRupees('1.234')).toBeNull()
    expect(parseRupees('')).toBeNull()
  })
  it('formats and round-trips', () => {
    expect(formatINR(125050)).toBe('₹1,250.50')
    expect(paiseToInput(125050)).toBe('1250.50')
    expect(paiseToInput(125000)).toBe('1250')
    expect(parseRupees(paiseToInput(99))).toBe(99)
  })
})

describe('csv', () => {
  it('escapes formula-like cells and quotes delimiters', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+91 98100')).toBe("'+91 98100")
    expect(csvCell('-5')).toBe('-5')
    expect(csvCell('-500.00')).toBe('-500.00')
    expect(csvCell('-5abc')).toBe("'-5abc")
    expect(csvCell('@cmd')).toBe("'@cmd")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('')
    expect(toCsv(['a'], [['=1+1']])).toContain("'=1+1")
  })
})

describe('membership + invoice derivation', () => {
  const ms: Membership = { id: 'ms1', createdAt: '', updatedAt: '', rev: 1, memberId: 'm', planId: 'p', planName: 'Monthly', durationValue: 1, durationUnit: 'months', startDate: '2026-10-01', endDate: '2026-10-31', listPricePaise: 150000, discountPaise: 0, pricePaise: 150000, invoiceId: 'i1' }
  it('derives state from dates only', () => {
    expect(membershipState(ms, '2026-09-30')).toBe('upcoming')
    expect(membershipState(ms, '2026-10-10')).toBe('active')
    expect(membershipState(ms, '2026-10-27')).toBe('expiring')
    expect(membershipState(ms, '2026-10-31')).toBe('expiring')
    expect(membershipState(ms, '2026-11-01')).toBe('expired')
  })
  it('does not infer paid from active', () => {
    const inv: Invoice = { id: 'i1', createdAt: '', updatedAt: '', rev: 1, number: 'INV-1', memberId: 'm', issueDate: '2026-10-01', lines: [], subtotalPaise: 150000, discountPaise: 0, totalPaise: 150000, status: 'issued' }
    const none = invoiceBalance(inv, [], [])
    expect(none.status).toBe('unpaid')
    expect(none.balancePaise).toBe(150000)
    const pays: Payment[] = [
      { id: 'p1', createdAt: '', updatedAt: '', rev: 1, memberId: 'm', invoiceId: 'i1', amountPaise: 100000, method: 'cash', receivedAt: '', status: 'recorded' },
      { id: 'p2', createdAt: '', updatedAt: '', rev: 1, memberId: 'm', invoiceId: 'i1', amountPaise: 50000, method: 'upi', receivedAt: '', status: 'void' },
    ]
    const partial = invoiceBalance(inv, pays, [])
    expect(partial.status).toBe('partial')
    expect(partial.balancePaise).toBe(50000)
    const adj: Adjustment[] = [{ id: 'a1', createdAt: '', updatedAt: '', rev: 1, invoiceId: 'i1', memberId: 'm', amountPaise: -50000, reason: 'waiver' }]
    const settled = invoiceBalance(inv, pays, adj)
    expect(settled.status).toBe('paid')
    expect(settled.duePaise).toBe(100000)
    expect(invoiceBalance({ ...inv, status: 'void' }, pays, adj).duePaise).toBe(0)
    expect(memberBalance([inv], pays, adj).balancePaise).toBe(0)
  })
})
