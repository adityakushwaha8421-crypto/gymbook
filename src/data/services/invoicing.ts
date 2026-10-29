import { DEFAULT_SETTINGS } from './settings'
import type { IDBPTransaction, StoreNames } from 'idb'
import type { GymDB } from '../db'
import type { Invoice, InvoiceLine, ISODate, Paise } from '@/domain/types'
import { stampNew } from '../repo'

type TxWithInvoices = IDBPTransaction<GymDB, StoreNames<GymDB>[], 'readwrite'>

/**
 * Allocate the next invoice number inside the caller's transaction, so the
 * counter and the invoice commit together or not at all.
 */
export async function nextInvoiceNumber(tx: TxWithInvoices): Promise<string> {
  const settings = await tx.objectStore('settings').get('settings')
  const prefix = settings?.invoicePrefix ?? DEFAULT_SETTINGS.invoicePrefix
  const counters = tx.objectStore('counters')
  const current = (await counters.get('invoice'))?.value ?? 0
  const next = current + 1
  await counters.put({ key: 'invoice', value: next })
  return `${prefix}-${String(next).padStart(5, '0')}`
}

export function buildInvoice(input: {
  number: string
  memberId: string
  membershipId?: string
  issueDate: ISODate
  lines: InvoiceLine[]
  discountPaise: Paise
  note?: string
  sample?: boolean
}): Invoice {
  const subtotalPaise = input.lines.reduce((s, l) => s + l.amountPaise, 0)
  const totalPaise = Math.max(0, subtotalPaise - input.discountPaise)
  return stampNew(
    'inv',
    {
      number: input.number,
      memberId: input.memberId,
      membershipId: input.membershipId,
      issueDate: input.issueDate,
      lines: input.lines,
      subtotalPaise,
      discountPaise: input.discountPaise,
      totalPaise,
      status: 'issued' as const,
      note: input.note,
    },
    input.sample,
  ) as Invoice
}
