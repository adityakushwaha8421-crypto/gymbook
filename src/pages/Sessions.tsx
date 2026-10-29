import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Check, X, UserX, Trash2, Pencil, CalendarClock } from 'lucide-react'
import { usePage, useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { loadSnapshot, SNAPSHOT_STORES } from '@/data/snapshot'
import { saveSession, setSessionStatus, deleteSession, findSessionConflict, sessionEnd } from '@/data/services/sessions'
import { sessionForm, type SessionFormValues } from '@/domain/validation'
import { useForm } from '@/lib/forms'
import { labelFor, SESSION_STATUSES, type Member, type Session, type SessionStatus, type Trainer } from '@/domain/types'
import { addDays, formatDate, formatTime, instantToDateInTz, instantToLocalDateTime, localDateTimeToInstant, formatMinutes } from '@/domain/dates'
import { memberRows } from '@/domain/metrics'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea, FormError } from '@/components/ui/Field'
import { Tabs, Avatar } from '@/components/ui/misc'
import { Badge, SampleBadge, type Tone } from '@/components/ui/Badge'
import { PageLoading } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { PageActions } from '@/components/ui/PageActions'
import { FormModal } from '@/components/domain/FormModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { MemberPicker } from '@/components/domain/MemberPicker'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/data/errors'
import type { Snapshot } from '@/data/snapshot'


const statusTone: Record<SessionStatus, Tone> = { scheduled: 'info', completed: 'accent', cancelled: 'muted', no_show: 'danger' }

export function SessionsPage() {
  usePage('PT sessions', 'Book and track personal-training sessions between trainers and members.')
  const { today, timezone } = useApp()
  const toast = useToast()
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [trainerFilter, setTrainerFilter] = useState('all')
  const [editing, setEditing] = useState<Session | 'new' | null>(null)
  const [removing, setRemoving] = useState<Session | null>(null)

  const names = useMemo(() => ({ member: new Map((snap.data?.members ?? []).map((m) => [m.id, m])), trainer: new Map((snap.data?.trainers ?? []).map((t) => [t.id, t])) }), [snap.data])
  const list = useMemo(() => {
    const all = (snap.data?.sessions ?? []).filter((s) => trainerFilter === 'all' || s.trainerId === trainerFilter)
    const upcoming = all.filter((s) => s.status === 'scheduled' && instantToDateInTz(s.startAt, timezone) >= today).sort((a, b) => a.startAt.localeCompare(b.startAt))
    const past = all.filter((s) => !(s.status === 'scheduled' && instantToDateInTz(s.startAt, timezone) >= today)).sort((a, b) => b.startAt.localeCompare(a.startAt))
    return { upcoming, past }
  }, [snap.data, trainerFilter, today, timezone])
  const groups = useMemo(() => {
    const src = tab === 'upcoming' ? list.upcoming : list.past.slice(0, 100)
    const map = new Map<string, Session[]>()
    for (const s of src) {
      const d = instantToDateInTz(s.startAt, timezone)
      map.set(d, [...(map.get(d) ?? []), s])
    }
    return [...map.entries()]
  }, [list, tab, timezone])

  if (snap.error) return <ErrorState message={snap.error} />
  if (!snap.data) return <PageLoading />
  const activeTrainers = snap.data.trainers.filter((t) => t.status === 'active')

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
    } catch (err) {
      toast.error('Could not update session', errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageActions>
        <Button icon={<CalendarPlus className="h-4 w-4" aria-hidden />} onClick={() => setEditing('new')} disabled={activeTrainers.length === 0}>
          Book session
        </Button>
      </PageActions>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'upcoming', label: 'Upcoming', count: list.upcoming.length }, { value: 'past', label: 'Past', count: list.past.length }]} />
        <Select aria-label="Trainer" value={trainerFilter} onChange={(e) => setTrainerFilter(e.target.value)} className="w-full text-sm sm:w-auto">
          <option value="all">All trainers</option>
          {snap.data.trainers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </div>
      {activeTrainers.length === 0 ? (
        <Card><EmptyState icon={<CalendarClock className="h-5 w-5" aria-hidden />} title="Add a trainer first" description="PT sessions are booked against a trainer. Add one under Trainers." action={<Link to="/trainers" className="text-sm font-medium text-accent-ink hover:underline">Go to Trainers →</Link>} /></Card>
      ) : groups.length === 0 ? (
        <Card><EmptyState icon={<CalendarClock className="h-5 w-5" aria-hidden />} title={tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'} description={tab === 'upcoming' ? 'Book a session to see it here.' : 'Completed, cancelled and no-show sessions appear here.'} action={tab === 'upcoming' ? <Button size="sm" onClick={() => setEditing('new')} icon={<CalendarPlus className="h-4 w-4" aria-hidden />}>Book session</Button> : undefined} /></Card>
      ) : (
        groups.map(([date, sessions]) => (
          <Card key={date}>
            <CardHeader title={date === today ? `Today · ${formatDate(date, 'long')}` : date === addDays(today, 1) ? `Tomorrow · ${formatDate(date, 'long')}` : formatDate(date, 'long')} description={`${sessions.length} session${sessions.length === 1 ? '' : 's'}`} />
            <ul className="mt-2 divide-y divide-line">
              {sessions.map((s) => {
                const m = names.member.get(s.memberId)
                const t = names.trainer.get(s.trainerId)
                return (
                  <li key={s.id} className="flex flex-col gap-2 px-5 py-3 xl:flex-row xl:items-center">
                    <div className="tabular w-28 shrink-0 text-sm font-medium">{formatTime(s.startAt, timezone)} <span className="text-muted">· {s.durationMinutes} min</span></div>
                    <div className="flex min-w-0 flex-1 items-center gap-3 [&_p]:whitespace-nowrap [&_p]:overflow-hidden [&_p]:text-ellipsis">
                      <Avatar name={m?.name ?? '?'} src={m?.photoDataUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <Link to={`/members/${s.memberId}?tab=sessions`} className="font-medium hover:underline">{m?.name ?? 'Unknown member'}</Link>
                          <span className="text-muted">with</span>
                          <Link to={`/trainers/${s.trainerId}`} className="hover:underline">{t?.name ?? 'Unknown trainer'}</Link>
                          {s.sample ? <SampleBadge /> : null}
                        </p>
                        {s.note ? <p className="truncate text-xs text-muted">{s.note}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
                      <Badge tone={statusTone[s.status]} dot>{labelFor(SESSION_STATUSES, s.status)}</Badge>
                      {s.status === 'scheduled' ? (
                        <>
                          <Button size="sm" variant="secondary" icon={<Check className="h-4 w-4" aria-hidden />} onClick={() => act(() => setSessionStatus(s.id, s.rev, 'completed'), 'Session completed')}>Done</Button>
                          <Button size="sm" variant="ghost" icon={<UserX className="h-4 w-4" aria-hidden />} onClick={() => act(() => setSessionStatus(s.id, s.rev, 'no_show'), 'Marked as no-show')}>No-show</Button>
                          <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" aria-hidden />} onClick={() => act(() => setSessionStatus(s.id, s.rev, 'cancelled'), 'Session cancelled')}>Cancel</Button>
                          <Button size="sm" variant="ghost" aria-label="Edit session" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing(s)} />
                          <Button size="sm" variant="ghost" aria-label="Remove session" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setRemoving(s)} />
                        </>
                      ) : s.status === 'cancelled' || s.status === 'no_show' ? (
                        <Button size="sm" variant="ghost" onClick={() => act(() => setSessionStatus(s.id, s.rev, 'scheduled'), 'Session restored')}>Reschedule</Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))
      )}
      {editing ? <SessionDialog snap={snap.data} existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog open={removing !== null} onClose={() => setRemoving(null)} title="Remove this session?" description="Only scheduled sessions can be removed. Use Cancel instead if you want to keep a record." confirmLabel="Remove" danger onConfirm={async () => { if (removing) { await deleteSession(removing.id); toast.success('Session removed') } }} />
    </div>
  )
}

export function SessionDialog({ snap, existing, onClose, presetMemberId, presetTrainerId }: { snap: Snapshot; existing?: Session; onClose: () => void; presetMemberId?: string; presetTrainerId?: string }) {
  const { today, timezone } = useApp()
  const toast = useToast()
  const rows = useMemo(() => memberRows(snap, today).filter((r) => r.member.status !== 'archived'), [snap, today])
  const trainers = snap.trainers.filter((t) => t.status === 'active' || t.id === existing?.trainerId)
  const initialMember = rows.find((r) => r.member.id === (existing?.memberId ?? presetMemberId))?.member ?? null
  const [member, setMember] = useState<Member | null>(initialMember)
  const defaultStart = existing ? instantToLocalDateTime(existing.startAt, timezone) : `${today}T${String(new Date().getHours() + 1).padStart(2, '0')}:00`

  const form = useForm<{ trainerId: string; memberId: string; startAt: string; durationMinutes: string; note: string }, SessionFormValues>(
    { trainerId: existing?.trainerId ?? presetTrainerId ?? trainers[0]?.id ?? '', memberId: existing?.memberId ?? presetMemberId ?? '', startAt: defaultStart, durationMinutes: String(existing?.durationMinutes ?? 60), note: existing?.note ?? '' },
    sessionForm,
    async (values, { requestKey }) => {
      await saveSession({ ...values, startAtInstant: localDateTimeToInstant(values.startAt, timezone) }, timezone, existing?.id, existing?.rev, requestKey)
      toast.success(existing ? 'Session updated' : 'Session booked')
      onClose()
    },
  )

  // Live hints: conflicts with other sessions and whether the trainer is rostered at that time.
  const hints = useMemo(() => {
    const parsed = sessionForm.safeParse(form.values)
    if (!parsed.success) return null
    const startAt = localDateTimeToInstant(parsed.data.startAt, timezone)
    const candidate = { trainerId: parsed.data.trainerId, memberId: parsed.data.memberId, startAt, durationMinutes: parsed.data.durationMinutes }
    const clash = findSessionConflict(snap.sessions, candidate, existing?.id)
    const date = instantToDateInTz(startAt, timezone)
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay()
    const [, time] = parsed.data.startAt.split('T')
    const [hh, mm] = time.split(':').map(Number)
    const startMin = hh * 60 + mm
    const endMin = startMin + parsed.data.durationMinutes
    const slots = snap.schedules.filter((s) => s.trainerId === parsed.data.trainerId && s.weekday === weekday)
    const rostered = slots.length === 0 ? null : slots.some((s) => s.startMinutes <= startMin && endMin <= s.endMinutes)
    const trainer: Trainer | undefined = snap.trainers.find((t) => t.id === parsed.data.trainerId)
    return { clash, rostered, slots, trainer, end: sessionEnd(candidate) }
  }, [form.values, snap, timezone, existing?.id])

  return (
    <FormModal open onClose={onClose} dirty={form.dirty} saving={form.saving} title={existing ? 'Edit session' : 'Book a PT session'} description="Sessions are checked for double-booking of the trainer and the member."
      footer={(requestClose) => <><Button variant="secondary" onClick={requestClose} disabled={form.saving}>Cancel</Button><Button onClick={() => form.submit()} loading={form.saving} data-primary>{existing ? 'Save' : 'Book session'}</Button></>}
    >
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-4">
        <Field label="Trainer" required error={form.errors.trainerId}>
          {({ id, invalid }) => (
            <Select id={id} aria-invalid={invalid} value={form.values.trainerId} onChange={(e) => form.set('trainerId', e.target.value)} autoFocus>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.status === 'archived' ? ' (archived)' : ''}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Member" required error={form.errors.memberId}>
          {({ id, invalid, describedBy }) => <MemberPicker id={id} invalid={invalid} describedBy={describedBy} rows={rows.map((r) => ({ member: r.member, state: r.state }))} value={member} onChange={(m) => { setMember(m); form.set('memberId', m?.id ?? '') }} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date and time" required error={form.errors.startAt}>
            {({ id, invalid }) => <Input id={id} type="datetime-local" aria-invalid={invalid} value={form.values.startAt} onChange={(e) => form.set('startAt', e.target.value)} step={300} />}
          </Field>
          <Field label="Duration (minutes)" required error={form.errors.durationMinutes}>
            {({ id, invalid }) => <Input id={id} type="number" inputMode="numeric" min={5} max={480} step={5} aria-invalid={invalid} value={form.values.durationMinutes} onChange={(e) => form.set('durationMinutes', e.target.value)} />}
          </Field>
        </div>
        {hints ? (
          <div className="flex flex-col gap-1 rounded-xl bg-sunken/60 px-3.5 py-2.5 text-sm">
            {hints.clash ? <p className="font-medium text-danger">Clashes with another session at {formatTime(hints.clash.session.startAt, timezone)} for the {hints.clash.who}.</p> : <p className="text-muted">Ends {formatTime(hints.end, timezone)}. No clashes.</p>}
            {hints.rostered === false ? <p className="text-warn">{hints.trainer?.name} is not rostered then (slots: {hints.slots.map((s) => `${formatMinutes(s.startMinutes)}–${formatMinutes(s.endMinutes)}`).join(', ')}). You can still book.</p> : null}
            {hints.rostered === null ? <p className="text-xs text-muted">No schedule set for this trainer on that weekday.</p> : null}
          </div>
        ) : null}
        <Field label="Note" error={form.errors.note}>
          {({ id }) => <Textarea id={id} rows={2} value={form.values.note} onChange={(e) => form.set('note', e.target.value)} placeholder="Focus for the session" />}
        </Field>
        <FormError message={form.formError} />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </FormModal>
  )
}
