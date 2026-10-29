import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord, withIdempotency } from '../repo'
import type { Expense } from '@/domain/types'
import type { ExpenseFormValues } from '@/domain/validation'
import { formatINR } from '@/domain/money'

export async function listExpenses(): Promise<Expense[]> {
  return readTx(['expenses'], (tx) => tx.objectStore('expenses').getAll())
}

export async function createExpense(values: ExpenseFormValues, requestKey?: string): Promise<Expense> {
  return withIdempotency(requestKey, () =>
    writeTx(['expenses', 'activity'], async (tx) => {
      const e = stampNew('exp', {
        date: values.date,
        category: values.category,
        amountPaise: values.amount,
        method: values.method,
        vendor: values.vendor,
        note: values.note,
      }) as Expense
      await tx.objectStore('expenses').put(e)
      await logActivity(tx, { kind: 'expense', message: `Recorded ${values.category} expense of ${formatINR(e.amountPaise)}`, refType: 'expense', refId: e.id })
      return e
    }),
  )
}

export async function updateExpense(id: string, expectedRev: number, values: ExpenseFormValues): Promise<Expense> {
  return writeTx(['expenses', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'expenses', id, expectedRev, (e) => ({
      ...e,
      date: values.date,
      category: values.category,
      amountPaise: values.amount,
      method: values.method,
      vendor: values.vendor,
      note: values.note,
    }))
    await logActivity(tx, { kind: 'expense', message: `Updated ${next.category} expense of ${formatINR(next.amountPaise)}`, refType: 'expense', refId: id })
    return next
  })
}

export async function deleteExpense(id: string): Promise<void> {
  return writeTx(['expenses', 'activity'], async (tx) => {
    const e = await tx.objectStore('expenses').get(id)
    if (!e) return
    await tx.objectStore('expenses').delete(id)
    await logActivity(tx, { kind: 'expense', message: `Deleted ${e.category} expense of ${formatINR(e.amountPaise)}` })
  })
}
