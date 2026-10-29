import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer, ArrowLeft, Receipt, SlidersHorizontal } from 'lucide-react'
import { useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { loadSnapshot, SNAPSHOT_STORES } from '@/data/snapshot'
import { addAdjustment } from '@/data/services/payments'
import { invoiceBalance } from '@/domain/membership'
import { formatINR, parseRupees } from '@/domain/money'
import { formatDate, formatDateTime } from '@/domain/dates'
import { labelFor, PAYMENT_METHODS } from '@/domain/types'
import { Button, LinkButton } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/EmptyState'
import { PaymentStatusBadge } from '@/components/domain/MembershipBadge'
import { PaymentDialog } from '@/components/domain/PaymentDialog'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, MoneyInput, Select, FormError } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/data/errors'

export function InvoicePage() {
  const { id = '' } = useParams()
  const { settings, timezone } = useApp()
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])
  const [payOpen, setPayOpen] = useState(false)
  const [adjOpen, setAdjOpen] = useState(false)

  const invoice = snap.data?.invoices.find((i) => i.id === id)
  const member = invoice ? snap.data?.members.find((m) => m.id === invoice.memberId) : undefined
  const data = useMemo(() => {
    if (!snap.data || !invoice) return null
    const payments = snap.data.payments.filter((p) => p.invoiceId === invoice.id).sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : 1))
    const adjustments = snap.data.adjustments.filter((a) => a.invoiceId === invoice.id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    const bal = invoiceBalance(invoice, payments, adjustments)
    return { payments, adjustments, bal }
  }, [snap.data, invoice])

  useEffect(() => {
    document.title = invoice ? `Invoice ${invoice.number} · GymBook` : 'Invoice · GymBook'
  }, [invoice])

  if (snap.error) return <div className="p-6"><ErrorState message={snap.error} /></div>
  if (!snap.data) return <PageLoading />
  if (!invoice || !member || !data) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState title="Invoice not found" message="This invoice does not exist in this browser’s data." action={<Link to="/payments" className="font-medium underline">Back to payments</Link>} />
      </div>
    )
  }

  const { bal, payments, adjustments } = data
  const gymLines = settings.address.split('\n').filter(Boolean)

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <div className="no-print glass sticky top-0 z-10 border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-2.5">
          <LinkButton to={`/members/${member.id}?tab=payments`} variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
            {member.name}
          </LinkButton>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {invoice.status === 'issued' ? (
              <Button size="sm" variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />} onClick={() => setAdjOpen(true)}>Adjust</Button>
            ) : null}
            {bal.balancePaise > 0 && member.status !== 'archived' ? (
              <Button size="sm" variant="secondary" icon={<Receipt className="h-4 w-4" aria-hidden />} onClick={() => setPayOpen(true)}>Record payment</Button>
            ) : null}
            <Button size="sm" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => window.print()}>Print / save PDF</Button>
          </div>
        </div>
      </div>

      <article className="mx-auto my-4 max-w-3xl rounded-2xl border border-line bg-surface p-6 shadow-card print:text-black print:my-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-10" aria-label={`Invoice ${invoice.number}`}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {settings.logoDataUrl ? <img src={settings.logoDataUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : null}
            <div>
              <h1 className="text-xl font-semibold">{settings.gymName}</h1>
              {gymLines.map((l, i) => (
                <p key={i} className="text-sm text-muted">{l}</p>
              ))}
              {settings.phone ? <p className="text-sm text-muted">{settings.phone}</p> : null}
              {settings.email ? <p className="text-sm text-muted">{settings.email}</p> : null}
              {settings.gstin ? <p className="text-sm text-muted">GSTIN {settings.gstin}</p> : null}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{invoice.status === 'void' ? 'Void invoice' : 'Invoice'}</p>
            <p className="text-2xl font-semibold">{invoice.number}</p>
            <p className="text-sm text-muted">Issued {formatDate(invoice.issueDate, 'long')}</p>
            <div className="mt-1 sm:flex sm:justify-end"><PaymentStatusBadge status={bal.status} /></div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Billed to</p>
            <p className="mt-1 font-medium">{member.name}</p>
            <p className="text-sm text-muted">{member.phone}</p>
            {member.email ? <p className="text-sm text-muted">{member.email}</p> : null}
          </div>
          {invoice.note ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Note</p>
              <p className="mt-1 text-sm">{invoice.note}</p>
            </div>
          ) : null}
        </section>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wider text-muted">
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 px-2 text-right">Qty</th>
              <th className="py-2 px-2 text-right">Rate</th>
              <th className="py-2 pl-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2.5 pr-2">{l.description}</td>
                <td className="tabular py-2.5 px-2 text-right">{l.quantity}</td>
                <td className="tabular py-2.5 px-2 text-right">{formatINR(l.unitPricePaise)}</td>
                <td className="tabular py-2.5 pl-2 text-right">{formatINR(l.amountPaise)}</td>
              </tr>
            ))}
            {adjustments.map((a) => (
              <tr key={a.id} className="border-b border-line text-muted">
                <td className="py-2.5 pr-2">Adjustment: {a.reason} <span className="text-xs">({formatDate(a.createdAt.slice(0, 10))})</span></td>
                <td className="py-2.5 px-2" />
                <td className="py-2.5 px-2" />
                <td className="tabular py-2.5 pl-2 text-right">{a.amountPaise < 0 ? '−' : '+'}{formatINR(Math.abs(a.amountPaise))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs text-sm">
            <Row label="Subtotal" value={formatINR(invoice.subtotalPaise)} />
            {invoice.discountPaise > 0 ? <Row label="Discount" value={`− ${formatINR(invoice.discountPaise)}`} /> : null}
            {bal.adjustmentsPaise !== 0 ? <Row label="Adjustments" value={`${bal.adjustmentsPaise < 0 ? '− ' : '+ '}${formatINR(Math.abs(bal.adjustmentsPaise))}`} /> : null}
            <Row label="Total" value={formatINR(bal.duePaise)} strong />
            <Row label="Paid" value={formatINR(bal.paidPaise)} />
            <Row label={bal.balancePaise < 0 ? 'Credit' : 'Balance due'} value={formatINR(Math.abs(bal.balancePaise))} strong tone={bal.balancePaise > 0 ? 'danger' : 'accent'} />
          </dl>
        </div>

        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Payments</p>
          {payments.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No payments recorded against this invoice yet.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={`border-b border-line ${p.status === 'void' ? 'text-muted line-through' : ''}`}>
                    <td className="py-2 pr-2">{formatDateTime(p.receivedAt, timezone)}</td>
                    <td className="py-2 px-2">{labelFor(PAYMENT_METHODS, p.method)}{p.reference ? ` · ${p.reference}` : ''}{p.status === 'void' ? ` · void: ${p.voidReason}` : ''}</td>
                    <td className="tabular py-2 pl-2 text-right">{formatINR(p.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {invoice.status === 'void' ? <p className="mt-6 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">This invoice was voided on {formatDateTime(invoice.voidedAt, timezone)}: {invoice.voidReason}</p> : null}

        <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">
          <p>{settings.invoiceFooter}</p>
          <p className="mt-1">Payments listed are records of money received; this document is generated by GymBook on {formatDate(new Date().toISOString().slice(0, 10))}.</p>
        </footer>
      </article>

      {payOpen ? <PaymentDialog open onClose={() => setPayOpen(false)} member={member} invoices={snap.data.invoices} payments={snap.data.payments} adjustments={snap.data.adjustments} preferredInvoiceId={invoice.id} /> : null}
      {adjOpen ? <AdjustmentDialog invoiceId={invoice.id} invoiceNumber={invoice.number} currentDue={bal.duePaise} onClose={() => setAdjOpen(false)} /> : null}
    </div>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'danger' | 'accent' }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? 'border-t border-line font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd className={`tabular ${tone === 'danger' ? 'text-danger' : tone === 'accent' ? 'text-accent-ink' : ''}`}>{value}</dd>
    </div>
  )
}

function AdjustmentDialog({ invoiceId, invoiceNumber, currentDue, onClose }: { invoiceId: string; invoiceNumber: string; currentDue: number; onClose: () => void }) {
  const toast = useToast()
  const [direction, setDirection] = useState<'reduce' | 'increase'>('reduce')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paise = parseRupees(amount)
  const valid = paise !== null && paise > 0 && reason.trim().length > 0

  const submit = async () => {
    if (!valid || busy || paise === null) return
    setBusy(true)
    setError(null)
    try {
      await addAdjustment({ invoiceId, amountPaise: direction === 'reduce' ? -paise : paise, reason })
      toast.success('Adjustment added', `${invoiceNumber} is now ${formatINR(currentDue + (direction === 'reduce' ? -paise : paise))}.`)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={`Adjust ${invoiceNumber}`} description="Corrections are added as separate lines so the original invoice stays intact." size="sm"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={submit} disabled={!valid} loading={busy} data-primary>Add adjustment</Button></>}
    >
      <div className="flex flex-col gap-3">
        <Field label="Direction">
          {({ id }) => (
            <Select id={id} value={direction} onChange={(e) => setDirection(e.target.value as 'reduce' | 'increase')}>
              <option value="reduce">Reduce amount owed (discount, waiver, correction)</option>
              <option value="increase">Increase amount owed (extra charge)</option>
            </Select>
          )}
        </Field>
        <Field label="Amount" required hint={`Current total ${formatINR(currentDue)}`}>
          {({ id, describedBy }) => <MoneyInput id={id} aria-describedby={describedBy} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />}
        </Field>
        <Field label="Reason" required>
          {({ id }) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Goodwill discount for late opening" />}
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
