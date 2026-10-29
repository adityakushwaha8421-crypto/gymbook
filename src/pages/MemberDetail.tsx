import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Pencil, Archive, ArchiveRestore, Receipt, CreditCard, ClipboardCheck, LogOut, FileText, Ban, CalendarPlus, Printer, Check, X, UserX } from 'lucide-react'
import { SessionDialog } from './Sessions'
import { assignWorkout } from '@/data/services/workouts'
import { setSessionStatus } from '@/data/services/sessions'
import { labelFor as labelOf, SESSION_STATUSES, GENDERS, type SessionStatus } from '@/domain/types'
import { ageOn, formatTime, instantToDateInTz } from '@/domain/dates'
import { Select } from '@/components/ui/Field'
import { usePage, useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { loadSnapshot, SNAPSHOT_STORES } from '@/data/snapshot'
import { listActivityForMember } from '@/data/services/activity'
import { setMemberArchived } from '@/data/services/members'
import { checkOut } from '@/data/services/attendance'
import { voidPayment, voidInvoice } from '@/data/services/payments'
import { membershipState, invoiceBalance, memberBalance, pickCurrentMembership, daysRemaining } from '@/domain/membership'
import { formatDate, formatDateTime, formatDuration, compareDates } from '@/domain/dates'
import { formatINR } from '@/domain/money'
import { labelFor, PAYMENT_METHODS } from '@/domain/types'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button, LinkButton } from '@/components/ui/Button'
import { Avatar, ContactLinks, KeyValue, Stat, Tabs, Banner } from '@/components/ui/misc'
import { Badge, SampleBadge } from '@/components/ui/Badge'
import { PageLoading } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { MembershipStateBadge, PaymentStatusBadge } from '@/components/domain/MembershipBadge'
import { MembershipDialog } from '@/components/domain/MembershipDialog'
import { PaymentDialog } from '@/components/domain/PaymentDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCheckIn } from '@/components/domain/CheckInDialog'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/data/errors'

type Tab = 'overview' | 'memberships' | 'attendance' | 'payments' | 'sessions'

export function MemberDetailPage() {
  const { id = '' } = useParams()
  const { today, timezone } = useApp()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])
  const activity = useLiveQuery(() => listActivityForMember(id), ['activity'], [id])
  const [dialog, setDialog] = useState<'membership' | 'payment' | 'archive' | 'session' | null>(null)
  const [voidTarget, setVoidTarget] = useState<{ kind: 'payment' | 'invoice'; id: string; rev: number; label: string } | null>(null)
  const [payInvoiceId, setPayInvoiceId] = useState<string | undefined>()

  const member = snap.data?.members.find((m) => m.id === id)
  usePage(member ? member.name : 'Member', member ? `Profile, memberships, attendance and payments for ${member.name}.` : undefined, { header: false })

  const data = useMemo(() => {
    if (!snap.data || !member) return null
    const memberships = snap.data.memberships.filter((m) => m.memberId === member.id).sort((a, b) => compareDates(b.startDate, a.startDate))
    const invoices = snap.data.invoices.filter((i) => i.memberId === member.id).sort((a, b) => (a.number < b.number ? 1 : -1))
    const payments = snap.data.payments.filter((p) => p.memberId === member.id).sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
    const adjustments = snap.data.adjustments.filter((a) => a.memberId === member.id)
    const attendance = snap.data.attendance.filter((a) => a.memberId === member.id).sort((a, b) => (a.checkInAt < b.checkInAt ? 1 : -1))
    const current = pickCurrentMembership(memberships, today)
    const balance = memberBalance(invoices, payments, adjustments)
    const trainer = member.trainerId ? snap.data.trainers.find((t) => t.id === member.trainerId) : undefined
    const openVisit = attendance.find((a) => a.checkOutAt === null)
    const sessions = snap.data.sessions.filter((s) => s.memberId === member.id).sort((a, b) => b.startAt.localeCompare(a.startAt))
    const workout = member.workoutPlanId ? snap.data.workouts.find((w) => w.id === member.workoutPlanId) : undefined
    const trainerName = new Map(snap.data.trainers.map((t) => [t.id, t.name]))
    return { memberships, invoices, payments, adjustments, attendance, current, state: current ? membershipState(current, today) : undefined, balance, trainer, openVisit, sessions, workout, trainerName }
  }, [snap.data, member, today])

  const { checkIn: doCheckIn, dialog: checkInDialog, busy: checkInBusy } = useCheckIn()

  if (snap.error) return <ErrorState message={snap.error} />
  if (!snap.data) return <PageLoading />
  if (!member || !data) {
    return <ErrorState title="Member not found" message="This member does not exist in this browser’s data. It may have been removed or the link is from another device." action={<Link to="/members" className="font-medium underline">Back to members</Link>} />
  }

  const archived = member.status === 'archived'
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })

  const onCheckOut = async (visitId: string, rev: number) => {
    try {
      await checkOut(visitId, rev)
      toast.success(`${member.name} checked out`)
    } catch (err) {
      toast.error('Could not check out', errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/members" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">← Members</Link>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={member.name} src={member.photoDataUrl} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold leading-tight">{member.name}</h1>
                {member.memberCode ? <Badge tone="neutral" title="Member code: search this at check-in"><span className="font-mono">{member.memberCode}</span></Badge> : null}
                {member.sample ? <SampleBadge /> : null}
                {archived ? <Badge tone="muted">Archived</Badge> : <MembershipStateBadge state={data.state} />}
                {data.openVisit ? <Badge tone="accent">In the gym now</Badge> : null}
              </div>
              <ContactLinks phone={member.phone} email={member.email} className="mt-1 text-sm" />
              <p className="mt-1 text-sm text-muted">
                Joined {formatDate(member.joiningDate)}
                {data.trainer ? <> · Trainer <Link to={`/trainers/${data.trainer.id}`} className="hover:underline">{data.trainer.name}</Link></> : null}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {!archived ? (
              <>
                <Button variant="primary" size="sm" icon={<CreditCard className="h-4 w-4" aria-hidden />} onClick={() => setDialog('membership')}>
                  {data.memberships.length ? 'Renew' : 'Sell membership'}
                </Button>
                <Button variant="secondary" size="sm" icon={<Receipt className="h-4 w-4" aria-hidden />} onClick={() => { setPayInvoiceId(undefined); setDialog('payment') }}>
                  Record payment
                </Button>
                {data.openVisit ? (
                  <Button variant="secondary" size="sm" icon={<LogOut className="h-4 w-4" aria-hidden />} onClick={() => onCheckOut(data.openVisit!.id, data.openVisit!.rev)}>
                    Check out
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" icon={<ClipboardCheck className="h-4 w-4" aria-hidden />} onClick={() => doCheckIn(member)} loading={checkInBusy}>
                    Check in
                  </Button>
                )}
              </>
            ) : null}
            <LinkButton to={`/members/${member.id}/edit`} variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" aria-hidden />}>
              Edit
            </LinkButton>
            <Button variant="ghost" size="sm" icon={archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />} onClick={() => setDialog('archive')}>
              {archived ? 'Restore' : 'Archive'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {archived ? <Banner tone="warn">This member is archived. Their memberships, payments and invoices are kept for records. Restore them to sell memberships or check in again.</Banner> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Current plan" value={data.current ? data.current.planName : '—'} hint={data.current ? (data.state === 'upcoming' ? `Starts ${formatDate(data.current.startDate)}` : `${data.state === 'expired' ? 'Ended' : 'Ends'} ${formatDate(data.current.endDate)}`) : 'No membership yet'} />
        <Stat label="Days left" value={data.current && data.state !== 'expired' && data.state !== 'upcoming' ? daysRemaining(data.current, today) : '—'} tone={data.state === 'expiring' ? 'warn' : undefined} />
        <Stat label="Outstanding" value={formatINR(Math.max(0, data.balance.balancePaise))} tone={data.balance.balancePaise > 0 ? 'danger' : undefined} hint={data.balance.balancePaise < 0 ? `${formatINR(-data.balance.balancePaise)} credit` : `${formatINR(data.balance.paidPaise)} paid of ${formatINR(data.balance.invoicedPaise)}`} />
        <Stat label="Visits" value={data.attendance.length} hint={data.attendance[0] ? `Last ${formatDateTime(data.attendance[0].checkInAt, timezone)}` : 'No visits recorded'} />
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { value: 'overview', label: 'Overview' },
        { value: 'memberships', label: 'Memberships', count: data.memberships.length },
        { value: 'attendance', label: 'Attendance', count: data.attendance.length },
        { value: 'payments', label: 'Payments & invoices', count: data.invoices.length },
        { value: 'sessions', label: 'PT sessions', count: data.sessions.length },
      ]} />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <KeyValue items={[
                { label: 'Phone', value: <ContactLinks phone={member.phone} /> },
                { label: 'Email', value: member.email ? <ContactLinks email={member.email} /> : '—' },
                { label: 'Joining date', value: formatDate(member.joiningDate) },
                { label: 'Trainer', value: data.trainer ? <Link to={`/trainers/${data.trainer.id}`} className="hover:underline">{data.trainer.name}</Link> : '—' },
                { label: 'Notes', value: member.notes ? <span className="whitespace-pre-wrap">{member.notes}</span> : '—' },
                { label: 'Record', value: `Updated ${formatDateTime(member.updatedAt, timezone)}` },
              ]} />
            </CardBody>
            <CardHeader title="Profile" description="Emergency and health details are for staff only." />
            <CardBody>
              <KeyValue items={[
                { label: 'Member code', value: member.memberCode ? <span className="font-mono">{member.memberCode}</span> : '—' },
                { label: 'Date of birth', value: member.dateOfBirth ? `${formatDate(member.dateOfBirth)} (${ageOn(member.dateOfBirth, today)} years)` : '—' },
                { label: 'Gender', value: member.gender ? labelOf(GENDERS, member.gender) : '—' },
                { label: 'Fitness goal', value: member.goal || '—' },
                { label: 'Emergency contact', value: member.emergencyName || member.emergencyPhone ? <span>{member.emergencyName}{member.emergencyName && member.emergencyPhone ? ' · ' : ''}{member.emergencyPhone ? <a href={`tel:${member.emergencyPhone.replace(/[^\d+]/g, '')}`} className="tabular hover:underline">{member.emergencyPhone}</a> : null}</span> : '—' },
                { label: 'Health notes', value: member.healthNotes ? <span className="whitespace-pre-wrap text-warn">{member.healthNotes}</span> : '—' },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Workout plan" description="Assigned programme; print a sheet for the floor." action={data.workout ? <Button size="sm" variant="secondary" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => window.open(`/workouts/${data.workout!.id}/print?member=${member.id}`, '_blank', 'noopener')}>Print sheet</Button> : undefined} />
            <CardBody className="flex flex-col gap-3">
              {data.workout ? (
                <div>
                  <p className="font-medium">{data.workout.name} {data.workout.archived ? <Badge tone="muted">Archived plan</Badge> : null}</p>
                  <p className="text-sm text-muted">{data.workout.goal} · {data.workout.days.length} day{data.workout.days.length === 1 ? '' : 's'} · {data.workout.days.reduce((s, d) => s + d.exercises.length, 0)} exercises</p>
                </div>
              ) : (
                <p className="text-sm text-muted">No plan assigned yet.</p>
              )}
              {!archived ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select aria-label="Assign workout plan" value={member.workoutPlanId ?? ''} onChange={async (e) => { try { await assignWorkout(member.id, member.rev, e.target.value || null); toast.success(e.target.value ? 'Workout plan assigned' : 'Workout plan cleared') } catch (err) { toast.error('Could not assign plan', errorMessage(err)) } }} className="text-sm">
                    <option value="">No plan</option>
                    {snap.data.workouts.filter((w) => !w.archived || w.id === member.workoutPlanId).map((w) => (
                      <option key={w.id} value={w.id}>{w.name} · {w.goal}{w.archived ? ' (archived)' : ''}</option>
                    ))}
                  </Select>
                  <Link to="/workouts" className="text-sm text-accent-ink hover:underline">Manage plans</Link>
                </div>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Activity" description="Changes to this member’s records." />
            {activity.data && activity.data.length === 0 ? <EmptyState compact title="No activity yet" /> : (
              <ul className="divide-y divide-line">
                {(activity.data ?? []).slice(0, 15).map((a) => (
                  <li key={a.id} className="px-4 py-2.5 sm:px-5">
                    <p className="text-sm">{a.message}</p>
                    <p className="text-xs text-muted">{formatDateTime(a.at, timezone)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'memberships' ? (
        <Card>
          <CardHeader title="Memberships" description="Status comes from the dates. Paid status comes from the invoice, not from whether the plan is active." />
          {data.memberships.length === 0 ? (
            <EmptyState compact title="No memberships yet" action={!archived ? <Button size="sm" onClick={() => setDialog('membership')}>Sell membership</Button> : undefined} />
          ) : (
            <ul className="divide-y divide-line">
              {data.memberships.map((m) => {
                const inv = data.invoices.find((i) => i.id === m.invoiceId)
                const bal = inv ? invoiceBalance(inv, data.payments, data.adjustments) : undefined
                const st = membershipState(m, today)
                return (
                  <li key={m.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {m.planName}
                        <MembershipStateBadge state={st} />
                        {m.renewalOfId ? <Badge tone="muted">Renewal</Badge> : null}
                        {m.sample ? <SampleBadge /> : null}
                      </p>
                      {m.cancelReason ? <p className="text-xs text-muted">{m.cancelReason}</p> : null}
                      <p className="text-sm text-muted">
                        {formatDate(m.startDate)} → {formatDate(m.endDate)} · {m.durationValue} {m.durationUnit} · {formatINR(m.pricePaise)}
                        {m.discountPaise > 0 ? ` (list ${formatINR(m.listPricePaise)} − ${formatINR(m.discountPaise)} discount)` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {bal ? <PaymentStatusBadge status={bal.status} /> : null}
                      {bal && bal.balancePaise > 0 ? <span className="tabular text-danger">{formatINR(bal.balancePaise)} due</span> : null}
                      {inv ? <Link to={`/invoices/${inv.id}`} className="inline-flex items-center gap-1 text-accent-ink hover:underline"><FileText className="h-4 w-4" aria-hidden />{inv.number}</Link> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'attendance' ? (
        <Card>
          <CardHeader title="Attendance" description="Visits recorded by staff at the desk." />
          {data.attendance.length === 0 ? <EmptyState compact title="No visits yet" /> : (
            <ul className="divide-y divide-line">
              {data.attendance.slice(0, 60).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {formatDateTime(a.checkInAt, timezone)} {a.checkOutAt ? <span className="text-muted">→ {formatDuration(a.checkInAt, a.checkOutAt)}</span> : <Badge tone="accent">Checked in</Badge>}
                    </p>
                    {a.overrideReason ? <p className="text-xs text-warn">Allowed without membership: {a.overrideReason}</p> : null}
                  </div>
                  {!a.checkOutAt ? <Button size="sm" variant="secondary" onClick={() => onCheckOut(a.id, a.rev)}>Check out</Button> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'payments' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Invoices" action={!archived ? <Button size="sm" variant="secondary" onClick={() => { setPayInvoiceId(undefined); setDialog('payment') }}>Record payment</Button> : undefined} />
            {data.invoices.length === 0 ? <EmptyState compact title="No invoices" description="Invoices are created when a membership is sold." /> : (
              <ul className="divide-y divide-line">
                {data.invoices.map((inv) => {
                  const bal = invoiceBalance(inv, data.payments, data.adjustments)
                  return (
                    <li key={inv.id} className="flex flex-col gap-1.5 px-4 py-3 sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <Link to={`/invoices/${inv.id}`} className="font-medium hover:underline">{inv.number}</Link>
                        <PaymentStatusBadge status={bal.status} />
                      </div>
                      <p className="text-sm text-muted">{formatDate(inv.issueDate)} · total {formatINR(bal.duePaise)}{bal.adjustmentsPaise ? ` (incl. ${bal.adjustmentsPaise > 0 ? '+' : '−'}${formatINR(Math.abs(bal.adjustmentsPaise))} adj.)` : ''} · paid {formatINR(bal.paidPaise)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {bal.balancePaise > 0 && !archived ? <Button size="sm" variant="outline" onClick={() => { setPayInvoiceId(inv.id); setDialog('payment') }}>Pay {formatINR(bal.balancePaise)}</Button> : null}
                        {inv.status === 'issued' && bal.paidPaise === 0 ? (
                          <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" aria-hidden />} onClick={() => setVoidTarget({ kind: 'invoice', id: inv.id, rev: inv.rev, label: inv.number })}>Void</Button>
                        ) : null}
                        {inv.status === 'void' ? <span className="text-xs text-muted">Voided: {inv.voidReason}</span> : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Payments" description="Money received, newest first. Voided payments stay in the record." />
            {data.payments.length === 0 ? <EmptyState compact title="No payments yet" /> : (
              <ul className="divide-y divide-line">
                {data.payments.map((p) => {
                  const inv = p.invoiceId ? data.invoices.find((i) => i.id === p.invoiceId) : undefined
                  return (
                    <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className={`tabular font-medium ${p.status === 'void' ? 'text-muted line-through' : ''}`}>{formatINR(p.amountPaise)} <span className="text-sm font-normal text-muted">· {labelFor(PAYMENT_METHODS, p.method)}</span></p>
                        <p className="text-xs text-muted">{formatDateTime(p.receivedAt, timezone)}{inv ? ` · ${inv.number}` : ' · unlinked credit'}{p.reference ? ` · ref ${p.reference}` : ''}</p>
                        {p.status === 'void' ? <p className="text-xs text-danger">Voided: {p.voidReason}</p> : null}
                        {p.note ? <p className="text-xs text-muted">{p.note}</p> : null}
                      </div>
                      {p.status === 'recorded' ? <Button size="sm" variant="ghost" onClick={() => setVoidTarget({ kind: 'payment', id: p.id, rev: p.rev, label: formatINR(p.amountPaise) })}>Void</Button> : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'sessions' ? (
        <Card>
          <CardHeader title="PT sessions" description="Personal-training sessions with a trainer." action={!archived ? <Button size="sm" variant="secondary" icon={<CalendarPlus className="h-4 w-4" aria-hidden />} onClick={() => setDialog('session')}>Book session</Button> : undefined} />
          {data.sessions.length === 0 ? <EmptyState compact title="No sessions yet" description="Book a session with a trainer to track it here." /> : (
            <ul className="divide-y divide-line">
              {data.sessions.map((s) => {
                const tone = ({ scheduled: 'info', completed: 'accent', cancelled: 'muted', no_show: 'danger' } as const)[s.status]
                const set = async (status: SessionStatus) => { try { await setSessionStatus(s.id, s.rev, status); toast.success('Session updated') } catch (err) { toast.error('Could not update session', errorMessage(err)) } }
                return (
                  <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{formatDate(instantToDateInTz(s.startAt, timezone), 'long')} · {formatTime(s.startAt, timezone)} <span className="font-normal text-muted">· {s.durationMinutes} min with {data.trainerName.get(s.trainerId) ?? 'trainer'}</span><Badge tone={tone} dot>{labelOf(SESSION_STATUSES, s.status)}</Badge></p>
                      {s.note ? <p className="text-xs text-muted">{s.note}</p> : null}
                    </div>
                    {s.status === 'scheduled' ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" icon={<Check className="h-4 w-4" aria-hidden />} onClick={() => set('completed')}>Done</Button>
                        <Button size="sm" variant="ghost" icon={<UserX className="h-4 w-4" aria-hidden />} onClick={() => set('no_show')}>No-show</Button>
                        <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" aria-hidden />} onClick={() => set('cancelled')}>Cancel</Button>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {dialog === 'session' ? <SessionDialog snap={snap.data} presetMemberId={member.id} presetTrainerId={member.trainerId} onClose={() => setDialog(null)} /> : null}
      {dialog === 'membership' ? <MembershipDialog open onClose={() => setDialog(null)} member={member} plans={snap.data.plans} memberships={data.memberships} /> : null}
      {dialog === 'payment' ? <PaymentDialog open onClose={() => setDialog(null)} member={member} invoices={data.invoices} payments={data.payments} adjustments={data.adjustments} preferredInvoiceId={payInvoiceId} /> : null}
      <ConfirmDialog
        open={dialog === 'archive'}
        onClose={() => setDialog(null)}
        title={archived ? `Restore ${member.name}?` : `Archive ${member.name}?`}
        description={archived ? 'The member becomes active again and can be checked in and sold memberships.' : 'Archiving hides the member from everyday lists but keeps every membership, invoice and payment. Nothing is deleted.'}
        confirmLabel={archived ? 'Restore' : 'Archive'}
        danger={!archived}
        onConfirm={async () => {
          await setMemberArchived(member.id, member.rev, !archived)
          toast.success(archived ? 'Member restored' : 'Member archived')
        }}
      />
      <ConfirmDialog
        open={voidTarget !== null}
        onClose={() => setVoidTarget(null)}
        title={voidTarget?.kind === 'payment' ? `Void payment of ${voidTarget.label}?` : `Void invoice ${voidTarget?.label}?`}
        description={voidTarget?.kind === 'payment' ? 'The payment stays in history marked as void and no longer counts towards the balance.' : 'The invoice stays in history marked as void and no longer counts as owed.'}
        confirmLabel="Void"
        danger
        reasonLabel="Reason"
        onConfirm={async (reason) => {
          if (!voidTarget) return
          if (voidTarget.kind === 'payment') await voidPayment(voidTarget.id, voidTarget.rev, reason ?? '')
          else await voidInvoice(voidTarget.id, voidTarget.rev, reason ?? '')
          toast.success(voidTarget.kind === 'payment' ? 'Payment voided' : 'Invoice voided')
        }}
      />
      {checkInDialog}
    </div>
  )
}
