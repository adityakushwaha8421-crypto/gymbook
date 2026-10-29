import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import { usePage, useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { listExpenses, createExpense, updateExpense, deleteExpense } from '@/data/services/expenses'
import { expenseForm, type ExpenseFormValues } from '@/domain/validation'
import { useForm } from '@/lib/forms'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, labelFor, type Expense, type ExpenseCategory } from '@/domain/types'
import { formatINR, paiseToInput } from '@/domain/money'
import { formatDate } from '@/domain/dates'
import { periodPreset, type Period } from '@/domain/metrics'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageActions } from '@/components/ui/PageActions'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea, MoneyInput, FormError } from '@/components/ui/Field'
import { Stat } from '@/components/ui/misc'
import { Table, Th, Td, Tr, RowCard } from '@/components/ui/Table'
import { Pagination, paginate } from '@/components/ui/Pagination'
import { PageLoading } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { SampleBadge } from '@/components/ui/Badge'
import { FormModal } from '@/components/domain/FormModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PeriodPicker, type PresetName } from '@/components/domain/PeriodPicker'
import { useToast } from '@/components/ui/Toast'

const PAGE_SIZE = 25

export function ExpensesPage() {
  usePage('Expenses', 'Track rent, salaries, equipment and other gym costs.')
  const { today } = useApp()
  const isDesktop = useIsDesktop()
  const toast = useToast()
  const expenses = useLiveQuery(listExpenses, ['expenses'])
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const [preset, setPreset] = useState<PresetName>('month')
  const [period, setPeriod] = useState<Period>(() => periodPreset('month', today))
  const [category, setCategory] = useState<string>('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(
    () => (expenses.data ?? []).filter((e) => e.date >= period.start && e.date <= period.end && (category === 'all' || e.category === category)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [expenses.data, period, category],
  )
  const total = filtered.reduce((s, e) => s + e.amountPaise, 0)
  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of filtered) m.set(e.category, (m.get(e.category) ?? 0) + e.amountPaise)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])
  const { slice, pageCount, page: safePage } = paginate(filtered, page, PAGE_SIZE)

  if (expenses.error) return <ErrorState message={expenses.error} />
  if (!expenses.data) return <PageLoading />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodPicker preset={preset} period={period} today={today} onChange={(p, per) => { setPreset(p); setPeriod(per); setPage(1) }} />
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className="h-10 w-auto text-sm">
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
      </div>
      <PageActions>
        <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setEditing('new')}>Add expense</Button>
      </PageActions>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total in period" value={formatINR(total)} hint={`${filtered.length} record${filtered.length === 1 ? '' : 's'}`} />
        {byCategory.slice(0, 3).map(([c, v]) => (
          <Stat key={c} label={labelFor(EXPENSE_CATEGORIES, c as ExpenseCategory)} value={formatINR(v)} hint={total ? `${Math.round((v / total) * 100)}% of total` : undefined} />
        ))}
      </div>
      <p className="text-xs text-muted">Expenses are money the gym spent. They are kept separate from member payments, which are money received.</p>
      <Card>
        <CardHeader title="Expense records" />
        {filtered.length === 0 ? (
          <EmptyState compact icon={<Wallet className="h-5 w-5" aria-hidden />} title="No expenses in this period" description="Add rent, salaries, equipment or other costs to see them in reports." action={<Button size="sm" onClick={() => setEditing('new')} icon={<Plus className="h-4 w-4" aria-hidden />}>Add expense</Button>} />
        ) : isDesktop ? (
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Category</Th>
                  <Th>Vendor / note</Th>
                  <Th>Method</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {slice.map((e) => (
                  <Tr key={e.id}>
                    <Td className="text-muted">{formatDate(e.date)}</Td>
                    <Td><span className="flex items-center gap-2">{labelFor(EXPENSE_CATEGORIES, e.category)}{e.sample ? <SampleBadge /> : null}</span></Td>
                    <Td className="max-w-[18rem] truncate">{[e.vendor, e.note].filter(Boolean).join(' · ') || <span className="text-muted">—</span>}</Td>
                    <Td className="text-muted">{labelFor(PAYMENT_METHODS, e.method)}</Td>
                    <Td className="tabular text-right font-medium">{formatINR(e.amountPaise)}</Td>
                    <Td className="text-right">
                      <span className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" aria-label="Edit expense" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing(e)} />
                        <Button size="sm" variant="ghost" aria-label="Delete expense" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setDeleting(e)} />
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="mt-2">
            {slice.map((e) => (
              <RowCard key={e.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">{labelFor(EXPENSE_CATEGORIES, e.category)}{e.sample ? <SampleBadge /> : null}</p>
                    <p className="text-xs text-muted">{formatDate(e.date)} · {labelFor(PAYMENT_METHODS, e.method)}{e.vendor ? ` · ${e.vendor}` : ''}</p>
                    {e.note ? <p className="truncate text-xs text-muted">{e.note}</p> : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular text-sm font-semibold">{formatINR(e.amountPaise)}</span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" aria-label="Edit expense" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing(e)} />
                      <Button size="sm" variant="ghost" aria-label="Delete expense" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setDeleting(e)} />
                    </span>
                  </div>
                </div>
              </RowCard>
            ))}
          </div>
        )}
        <Pagination page={safePage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </Card>
      {editing ? <ExpenseDialog expense={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this expense?"
        description={deleting ? `${labelFor(EXPENSE_CATEGORIES, deleting.category)} · ${formatINR(deleting.amountPaise)} on ${formatDate(deleting.date)}. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!deleting) return
          await deleteExpense(deleting.id)
          toast.success('Expense deleted')
        }}
      />
    </div>
  )
}

function ExpenseDialog({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { today } = useApp()
  const toast = useToast()
  const form = useForm<{ date: string; category: ExpenseCategory; amount: string; method: 'cash' | 'upi' | 'bank' | 'card'; vendor: string; note: string }, ExpenseFormValues>(
    { date: expense?.date ?? today, category: expense?.category ?? 'other', amount: expense ? paiseToInput(expense.amountPaise) : '', method: expense?.method ?? 'cash', vendor: expense?.vendor ?? '', note: expense?.note ?? '' },
    expenseForm,
    async (values, { requestKey }) => {
      if (expense) {
        await updateExpense(expense.id, expense.rev, values)
        toast.success('Expense updated')
      } else {
        await createExpense(values, requestKey)
        toast.success('Expense recorded')
      }
      onClose()
    },
  )
  return (
    <FormModal open onClose={onClose} dirty={form.dirty} saving={form.saving} title={expense ? 'Edit expense' : 'Add expense'}
      footer={(requestClose) => <><Button variant="secondary" onClick={requestClose} disabled={form.saving}>Cancel</Button><Button onClick={() => form.submit()} loading={form.saving} data-primary>{expense ? 'Save changes' : 'Add expense'}</Button></>}
    >
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required error={form.errors.date}>
            {({ id, invalid }) => <Input id={id} type="date" aria-invalid={invalid} value={form.values.date} onChange={(e) => form.set('date', e.target.value)} autoFocus />}
          </Field>
          <Field label="Category" required error={form.errors.category}>
            {({ id }) => (
              <Select id={id} value={form.values.category} onChange={(e) => form.set('category', e.target.value as ExpenseCategory)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Amount" required error={form.errors.amount}>
            {({ id, invalid }) => <MoneyInput id={id} aria-invalid={invalid} value={form.values.amount} onChange={(e) => form.set('amount', e.target.value)} />}
          </Field>
          <Field label="Paid by" required error={form.errors.method}>
            {({ id }) => (
              <Select id={id} value={form.values.method} onChange={(e) => form.set('method', e.target.value as ExpenseFormValues['method'])}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Vendor" error={form.errors.vendor} className="sm:col-span-2">
            {({ id }) => <Input id={id} value={form.values.vendor} onChange={(e) => form.set('vendor', e.target.value)} placeholder="Who was paid" />}
          </Field>
          <Field label="Note" error={form.errors.note} className="sm:col-span-2">
            {({ id }) => <Textarea id={id} rows={2} value={form.values.note} onChange={(e) => form.set('note', e.target.value)} />}
          </Field>
        </div>
        <FormError message={form.formError} />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </FormModal>
  )
}
