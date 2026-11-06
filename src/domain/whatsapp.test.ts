import { describe, it, expect } from 'vitest'
import { daysLeftLabel, expiryMessage, invoiceMessage, membershipMessage, toWaNumber, whatsappUrl } from './whatsapp'

const gym = { gymName: 'R.K. Gym Fitness Centre', gymPhone: '098920 80444', memberName: 'Rahul Patil' }
const today = '2026-11-06'
const plan = { planName: 'Monthly', startDate: '2026-11-06', endDate: '2026-12-05' }

describe('whatsapp: links', () => {
  it('a bare 10-digit number is Indian; a + number and other lengths are kept', () => {
    expect(toWaNumber('98920 80444')).toBe('919892080444')
    expect(toWaNumber('+44 20 7946 0958')).toBe('442079460958')
    expect(toWaNumber('098920 80444')).toBe('09892080444')
  })
  it('emoji, bold marks and new lines survive the link', () => {
    const text = '💪 *Gym*\n\nHi Rahul 👋 & welcome'
    const url = new URL(whatsappUrl('9892080444', text))
    expect(url.origin + url.pathname).toBe('https://wa.me/919892080444')
    expect(url.searchParams.get('text')).toBe(text)
  })
  it('every emoji used is a single code point, with no variation selector or joiner', () => {
    const all = [
      membershipMessage({ ...gym, welcome: true, plan, money: { invoiceNumber: 'RK-00001', duePaise: 100, paidPaise: 50, balancePaise: 50 }, today }),
      membershipMessage({ ...gym, plan, money: { invoiceNumber: 'RK-00001', duePaise: 100, paidPaise: 200, balancePaise: -100 }, today }),
      invoiceMessage({ ...gym, issueDate: today, lines: [{ description: 'x', amountPaise: 100 }], discountPaise: 10, adjustmentsPaise: -5, money: { invoiceNumber: 'RK-00001', duePaise: 85, paidPaise: 0, balancePaise: 85 } }),
      expiryMessage({ ...gym, planName: 'Monthly', endDate: today, today }),
    ].join('\n')
    expect(all).not.toMatch(/[️‍]/)
  })
})

describe('whatsapp: daysLeftLabel', () => {
  it('covers expired, today, tomorrow and later', () => {
    expect(daysLeftLabel('2026-11-05', today)).toBe('expired')
    expect(daysLeftLabel('2026-11-06', today)).toBe('ends today')
    expect(daysLeftLabel('2026-11-07', today)).toBe('ends tomorrow')
    expect(daysLeftLabel('2026-12-05', today)).toBe('29 days left')
  })
})

describe('whatsapp: membershipMessage', () => {
  it('welcome with plan and a part payment: no member ID and no balance line', () => {
    expect(membershipMessage({ ...gym, welcome: true, plan, money: { invoiceNumber: 'RK-00012', duePaise: 140000, paidPaise: 50000, balancePaise: 90000 }, today })).toBe(
      [
        '💪 *R.K. Gym Fitness Centre*',
        '',
        'Hi Rahul Patil 👋',
        'Welcome to R.K. Gym Fitness Centre! 🎉',
        '',
        '📋 *Plan:* Monthly',
        '📅 *From:* 6 Nov 2026',
        '⏳ *Valid till:* 5 Dec 2026 (29 days left)',
        '',
        '🧾 *Invoice:* RK-00012',
        '💰 *Amount:* ₹1,400',
        '✅ *Paid:* ₹500',
        '',
        'Thank you 🙏',
        '📞 098920 80444',
      ].join('\n'),
    )
  })
  it('fully paid says so; nothing paid has no paid line; what is still owed is never mentioned', () => {
    const paid = membershipMessage({ ...gym, plan, money: { invoiceNumber: 'RK-00001', duePaise: 150000, paidPaise: 150000, balancePaise: 0 }, today })
    expect(paid).toContain('✅ *Paid:* ₹1,500 (fully paid)')
    expect(paid).not.toContain('Balance due')
    expect(paid).toContain('Here are your membership details:')
    const unpaid = membershipMessage({ ...gym, plan, money: { invoiceNumber: 'RK-00001', duePaise: 150000, paidPaise: 0, balancePaise: 150000 }, today })
    expect(unpaid).not.toContain('Paid:')
    expect(unpaid).not.toContain('Balance due')
    expect(unpaid).toContain('💰 *Amount:* ₹1,500')
    const credit = membershipMessage({ ...gym, plan, money: { invoiceNumber: 'RK-00001', duePaise: 150000, paidPaise: 160050, balancePaise: -10050 }, today })
    expect(credit).toContain('💳 *Credit with us:* ₹100.50')
  })
  it('a plan that has not started shows its start date and no days-left count', () => {
    const m = membershipMessage({ ...gym, plan: { planName: 'Quarterly', startDate: '2026-11-10', endDate: '2027-02-09' }, today })
    expect(m).toContain('📅 *Starts:* 10 Nov 2026')
    expect(m).toContain('⏳ *Valid till:* 9 Feb 2027\n')
  })
  it('without a plan it is a short welcome; the Sample label and a missing gym phone are left out', () => {
    expect(membershipMessage({ gymName: 'Test Gym', memberName: 'Sample Aarav Shah', welcome: true, today })).toBe(
      ['💪 *Test Gym*', '', 'Hi Aarav Shah 👋', 'Welcome to Test Gym! 🎉', '', 'Thank you 🙏'].join('\n'),
    )
  })
})

describe('whatsapp: invoiceMessage', () => {
  it('lists what was billed, the discount and adjustment, then paid and due', () => {
    expect(
      invoiceMessage({ ...gym, issueDate: today, lines: [{ description: 'Monthly membership (1 months) · 6 Nov 2026 to 5 Dec 2026', amountPaise: 150000 }], discountPaise: 10000, adjustmentsPaise: -5000, money: { invoiceNumber: 'RK-00012', duePaise: 135000, paidPaise: 50000, balancePaise: 85000 } }),
    ).toBe(
      [
        '💪 *R.K. Gym Fitness Centre*',
        '',
        'Hi Rahul Patil 👋',
        'Here is your invoice:',
        '',
        '🧾 *Invoice:* RK-00012',
        '📅 *Date:* 6 Nov 2026',
        '',
        '▪ Monthly membership (1 months) · 6 Nov 2026 to 5 Dec 2026: ₹1,500',
        '🎁 *Discount:* -₹100',
        '📝 *Adjustment:* -₹50',
        '',
        '💰 *Amount:* ₹1,350',
        '✅ *Paid:* ₹500',
        '🔔 *Balance due:* ₹850',
        '',
        'Thank you 🙏',
        '📞 098920 80444',
      ].join('\n'),
    )
  })
})

describe('whatsapp: expiryMessage', () => {
  const base = { ...gym, planName: 'Monthly', today }
  it('words the reminder by how close the last day is', () => {
    expect(expiryMessage({ ...base, endDate: '2026-11-09' })).toBe(
      ['💪 *R.K. Gym Fitness Centre*', '', 'Hi Rahul Patil 👋', '⏳ Your *Monthly* membership ends on *9 Nov 2026* (3 days left).', '', '🔁 Renew at the desk to keep your training going.', '', 'Thank you 🙏', '📞 098920 80444'].join('\n'),
    )
    expect(expiryMessage({ ...base, endDate: today })).toContain('membership ends *today*.')
    expect(expiryMessage({ ...base, endDate: '2026-11-07' })).toContain('membership ends *tomorrow*.')
    expect(expiryMessage({ ...base, endDate: '2026-11-01' })).toContain('membership ended on 1 Nov 2026.')
  })
})
