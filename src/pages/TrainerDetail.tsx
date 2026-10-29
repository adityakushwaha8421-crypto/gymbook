import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pencil, Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react'
import { usePage } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { loadSnapshot, SNAPSHOT_STORES } from '@/data/snapshot'
import { setTrainerArchived, saveSchedule, deleteSchedule, findScheduleOverlap } from '@/data/services/trainers'
import { scheduleForm, type ScheduleFormValues, toMinutes } from '@/domain/validation'
import { useForm } from '@/lib/forms'
import type { TrainerSchedule } from '@/domain/types'
import { WEEKDAYS, formatMinutes } from '@/domain/dates'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, FormError } from '@/components/ui/Field'
import { Avatar, ContactLinks, KeyValue, Banner } from '@/components/ui/misc'
import { Badge, SampleBadge } from '@/components/ui/Badge'
import { PageLoading } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { TrainerDialog } from '@/components/domain/TrainerDialog'
import { FormModal } from '@/components/domain/FormModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { MembershipStateBadge } from '@/components/domain/MembershipBadge'
import { memberRows } from '@/domain/metrics'
import { SessionDialog } from './Sessions'
import { formatTime, instantToDateInTz, formatDate } from '@/domain/dates'
import { CalendarPlus } from 'lucide-react'
import { useApp } from '@/app/AppContext'
import { useToast } from '@/components/ui/Toast'

export function TrainerDetailPage() {
  const { id = '' } = useParams()
  const { today, timezone } = useApp()
  const toast = useToast()
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [slot, setSlot] = useState<TrainerSchedule | 'new' | null>(null)
  const [removing, setRemoving] = useState<TrainerSchedule | null>(null)
  const [booking, setBooking] = useState(false)

  const trainer = snap.data?.trainers.find((t) => t.id === id)
  usePage(trainer ? trainer.name : 'Trainer', trainer ? `${trainer.specialty} trainer: assigned members and weekly schedule.` : undefined, { header: false })

  const schedules = useMemo(() => (snap.data?.schedules ?? []).filter((s) => s.trainerId === id).sort((a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes), [snap.data, id])
  const members = useMemo(() => (snap.data ? memberRows(snap.data, today).filter((r) => r.member.trainerId === id && r.member.status !== 'archived') : []), [snap.data, id, today])
  const upcoming = useMemo(() => (snap.data?.sessions ?? []).filter((s) => s.trainerId === id && s.status === 'scheduled' && instantToDateInTz(s.startAt, timezone) >= today).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 10), [snap.data, id, today, timezone])
  const memberName = useMemo(() => new Map((snap.data?.members ?? []).map((m) => [m.id, m.name])), [snap.data])

  if (snap.error) return <ErrorState message={snap.error} />
  if (!snap.data) return <PageLoading />
  if (!trainer) return <ErrorState title="Trainer not found" message="This trainer does not exist in this browser’s data." action={<Link to="/trainers" className="font-medium underline">Back to trainers</Link>} />
  const archived = trainer.status === 'archived'

  return (
    <div className="flex flex-col gap-4">
      <Link to="/trainers" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">← Trainers</Link>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={trainer.name} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold leading-tight">{trainer.name}</h1>
                {trainer.sample ? <SampleBadge /> : null}
                {archived ? <Badge tone="muted">Archived</Badge> : null}
              </div>
              <p className="text-sm text-muted">{trainer.specialty}</p>
              <ContactLinks phone={trainer.phone} email={trainer.email} className="mt-1 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="ghost" icon={archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />} onClick={() => setArchiving(true)}>{archived ? 'Restore' : 'Archive'}</Button>
          </div>
        </CardBody>
      </Card>
      {archived ? <Banner tone="warn">Archived trainers stay on existing member records but can’t be chosen for new assignments.</Banner> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Assigned members" description={`${members.length} active member${members.length === 1 ? '' : 's'}`} />
          {members.length === 0 ? <EmptyState compact title="No members assigned" description="Assign this trainer from a member’s edit page." /> : (
            <ul className="divide-y divide-line">
              {members.map((r) => (
                <li key={r.member.id}>
                  <Link to={`/members/${r.member.id}`} className="pressable flex items-center gap-3 px-4 py-2.5 hover:bg-sunken/60 sm:px-5">
                    <Avatar name={r.member.name} src={r.member.photoDataUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.member.name}</span>
                    <MembershipStateBadge state={r.state} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Weekly schedule" description="Planned availability. Overlapping slots on the same day are rejected." action={<Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setSlot('new')}>Add slot</Button>} />
          {schedules.length === 0 ? <EmptyState compact title="No schedule yet" description="Add the days and hours this trainer is on the floor." /> : (
            <ul className="divide-y divide-line">
              {schedules.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className="w-24 shrink-0 text-sm font-medium">{WEEKDAYS[s.weekday]}</span>
                  <span className="tabular min-w-0 flex-1 text-sm">{formatMinutes(s.startMinutes)} – {formatMinutes(s.endMinutes)} <span className="text-muted">· {s.label}</span></span>
                  <Button size="sm" variant="ghost" aria-label="Edit slot" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setSlot(s)} />
                  <Button size="sm" variant="ghost" aria-label="Delete slot" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setRemoving(s)} />
                </li>
              ))}
            </ul>
          )}
          <CardBody className="pt-0">
            <KeyValue items={[{ label: 'Notes', value: trainer.notes || '—' }]} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Upcoming PT sessions" description="Next ten scheduled sessions for this trainer." action={!archived ? <Button size="sm" variant="secondary" icon={<CalendarPlus className="h-4 w-4" aria-hidden />} onClick={() => setBooking(true)}>Book session</Button> : undefined} />
        {upcoming.length === 0 ? <EmptyState compact title="No upcoming sessions" description="Book one here or from a member’s page." /> : (
          <ul className="divide-y divide-line">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="tabular w-40 shrink-0 text-muted">{formatDate(instantToDateInTz(s.startAt, timezone))} · {formatTime(s.startAt, timezone)}</span>
                <Link to={`/members/${s.memberId}?tab=sessions`} className="min-w-0 flex-1 truncate font-medium hover:underline">{memberName.get(s.memberId) ?? 'Member'}</Link>
                <span className="text-xs text-muted">{s.durationMinutes} min</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing ? <TrainerDialog trainer={trainer} onClose={() => setEditing(false)} /> : null}
      {booking && snap.data ? <SessionDialog snap={snap.data} presetTrainerId={trainer.id} onClose={() => setBooking(false)} /> : null}
      {slot ? <ScheduleDialog trainerId={trainer.id} existing={slot === 'new' ? undefined : slot} all={schedules} onClose={() => setSlot(null)} /> : null}
      <ConfirmDialog open={archiving} onClose={() => setArchiving(false)} title={archived ? `Restore ${trainer.name}?` : `Archive ${trainer.name}?`} description={archived ? 'The trainer can be assigned to members again.' : 'Members currently assigned keep the link; the trainer is hidden from new assignments.'} confirmLabel={archived ? 'Restore' : 'Archive'} danger={!archived}
        onConfirm={async () => { await setTrainerArchived(trainer.id, trainer.rev, !archived); toast.success(archived ? 'Trainer restored' : 'Trainer archived') }} />
      <ConfirmDialog open={removing !== null} onClose={() => setRemoving(null)} title="Delete this slot?" description={removing ? `${WEEKDAYS[removing.weekday]} ${formatMinutes(removing.startMinutes)} – ${formatMinutes(removing.endMinutes)} · ${removing.label}` : undefined} confirmLabel="Delete" danger
        onConfirm={async () => { if (removing) { await deleteSchedule(removing.id); toast.success('Slot removed') } }} />
    </div>
  )
}

function ScheduleDialog({ trainerId, existing, all, onClose }: { trainerId: string; existing?: TrainerSchedule; all: TrainerSchedule[]; onClose: () => void }) {
  const toast = useToast()
  const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const form = useForm<{ weekday: string; startTime: string; endTime: string; label: string }, ScheduleFormValues>(
    { weekday: String(existing?.weekday ?? 1), startTime: existing ? toHHMM(existing.startMinutes) : '06:00', endTime: existing ? toHHMM(existing.endMinutes) : '10:00', label: existing?.label ?? '' },
    scheduleForm,
    async (values) => {
      await saveSchedule(trainerId, values, existing?.id, existing?.rev)
      toast.success(existing ? 'Slot updated' : 'Slot added')
      onClose()
    },
  )
  const live = (() => {
    const wd = Number(form.values.weekday)
    const s = /^\d{2}:\d{2}$/.test(form.values.startTime) ? toMinutes(form.values.startTime) : null
    const e = /^\d{2}:\d{2}$/.test(form.values.endTime) ? toMinutes(form.values.endTime) : null
    if (s === null || e === null || e <= s) return null
    return findScheduleOverlap(all, { weekday: wd, startMinutes: s, endMinutes: e }, existing?.id)
  })()
  return (
    <FormModal open onClose={onClose} dirty={form.dirty} saving={form.saving} title={existing ? 'Edit slot' : 'Add schedule slot'} size="sm"
      footer={(requestClose) => <><Button variant="secondary" onClick={requestClose} disabled={form.saving}>Cancel</Button><Button onClick={() => form.submit()} loading={form.saving} data-primary>{existing ? 'Save' : 'Add slot'}</Button></>}
    >
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-4">
        <Field label="Day" required error={form.errors.weekday}>
          {({ id }) => (
            <Select id={id} value={form.values.weekday} onChange={(e) => form.set('weekday', e.target.value)} autoFocus>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From" required error={form.errors.startTime}>
            {({ id, invalid }) => <Input id={id} type="time" aria-invalid={invalid} value={form.values.startTime} onChange={(e) => form.set('startTime', e.target.value)} />}
          </Field>
          <Field label="To" required error={form.errors.endTime}>
            {({ id, invalid }) => <Input id={id} type="time" aria-invalid={invalid} value={form.values.endTime} onChange={(e) => form.set('endTime', e.target.value)} />}
          </Field>
        </div>
        <Field label="Label" required error={form.errors.label}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={form.values.label} onChange={(e) => form.set('label', e.target.value)} placeholder="e.g. Morning floor" />}
        </Field>
        {live ? <p role="alert" className="text-sm text-warn">Overlaps “{live.label}” ({formatMinutes(live.startMinutes)} – {formatMinutes(live.endMinutes)}). Adjust the times to save.</p> : null}
        <FormError message={form.formError} />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </FormModal>
  )
}
