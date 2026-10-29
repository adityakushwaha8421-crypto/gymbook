import { useMemo, useState } from 'react'
import { Plus, Pencil, Archive, ArchiveRestore, AlertTriangle, Wrench, Check, Play } from 'lucide-react'
import { usePage, useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { loadSnapshot, SNAPSHOT_STORES, type Snapshot } from '@/data/snapshot'
import { createEquipment, updateEquipment, setEquipmentArchived, reportIncident, setIncidentStatus } from '@/data/services/equipment'
import { equipmentForm, incidentForm, type EquipmentFormValues, type IncidentFormValues } from '@/domain/validation'
import { useForm } from '@/lib/forms'
import { EQUIPMENT_STATUSES, INCIDENT_SEVERITIES, INCIDENT_STATUSES, labelFor, type Equipment, type EquipmentStatus, type Incident, type IncidentSeverity } from '@/domain/types'
import { formatDate, formatDateTime } from '@/domain/dates'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea, FormError } from '@/components/ui/Field'
import { Tabs, Stat } from '@/components/ui/misc'
import { Badge, SampleBadge, type Tone } from '@/components/ui/Badge'
import { PageLoading } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { PageActions } from '@/components/ui/PageActions'
import { FormModal } from '@/components/domain/FormModal'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/data/errors'

const eqTone: Record<EquipmentStatus, Tone> = { ok: 'accent', needs_service: 'warn', out_of_order: 'danger' }
const sevTone: Record<IncidentSeverity, Tone> = { low: 'muted', medium: 'warn', high: 'danger' }

export function EquipmentPage() {
  usePage('Equipment', 'Track machines, their condition and maintenance incidents.')
  const { timezone } = useApp()
  const toast = useToast()
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])
  const [tab, setTab] = useState<'equipment' | 'incidents'>('equipment')
  const [showRetired, setShowRetired] = useState(false)
  const [incidentFilter, setIncidentFilter] = useState<'open' | 'resolved'>('open')
  const [editing, setEditing] = useState<Equipment | 'new' | null>(null)
  const [reporting, setReporting] = useState<string | 'any' | null>(null)
  const [resolving, setResolving] = useState<Incident | null>(null)

  const equipment = useMemo(() => (snap.data?.equipment ?? []).filter((e) => showRetired || !e.archived).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [snap.data, showRetired])
  const incidents = useMemo(() => (snap.data?.incidents ?? []).filter((i) => (incidentFilter === 'open' ? i.status !== 'resolved' : i.status === 'resolved')).sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)), [snap.data, incidentFilter])
  const eqById = useMemo(() => new Map((snap.data?.equipment ?? []).map((e) => [e.id, e])), [snap.data])
  const openByEq = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of snap.data?.incidents ?? []) if (i.status !== 'resolved') m.set(i.equipmentId, (m.get(i.equipmentId) ?? 0) + 1)
    return m
  }, [snap.data])

  if (snap.error) return <ErrorState message={snap.error} />
  if (!snap.data) return <PageLoading />
  const live = snap.data.equipment.filter((e) => !e.archived)
  const openCount = snap.data.incidents.filter((i) => i.status !== 'resolved').length

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
    } catch (err) {
      toast.error('Could not update', errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageActions>
        <Button variant="secondary" icon={<AlertTriangle className="h-4 w-4" aria-hidden />} onClick={() => setReporting('any')} disabled={live.length === 0}>Report incident</Button>
        <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setEditing('new')}>Add equipment</Button>
      </PageActions>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In service" value={live.filter((e) => e.status === 'ok').length} hint={`${live.length} items in total`} />
        <Stat label="Needs service" value={live.filter((e) => e.status === 'needs_service').length} tone={live.some((e) => e.status === 'needs_service') ? 'warn' : undefined} />
        <Stat label="Out of order" value={live.filter((e) => e.status === 'out_of_order').length} tone={live.some((e) => e.status === 'out_of_order') ? 'danger' : undefined} />
        <Stat label="Open incidents" value={openCount} tone={openCount ? 'warn' : undefined} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'equipment', label: 'Equipment', count: equipment.length }, { value: 'incidents', label: 'Incidents', count: openCount }]} />
        {tab === 'equipment' ? (
          snap.data.equipment.some((e) => e.archived) ? <Button variant="ghost" size="sm" onClick={() => setShowRetired((s) => !s)}>{showRetired ? 'Hide retired' : 'Show retired'}</Button> : null
        ) : (
          <Tabs value={incidentFilter} onChange={setIncidentFilter} items={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]} />
        )}
      </div>

      {tab === 'equipment' ? (
        equipment.length === 0 ? (
          <Card><EmptyState icon={<Wrench className="h-5 w-5" aria-hidden />} title="No equipment yet" description="Add treadmills, racks and machines to track their condition and incidents." action={<Button size="sm" onClick={() => setEditing('new')} icon={<Plus className="h-4 w-4" aria-hidden />}>Add equipment</Button>} /></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.map((e) => (
              <Card key={e.id} className={e.archived ? 'opacity-70' : ''}>
                <CardBody className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">{e.name}{e.sample ? <SampleBadge /> : null}{e.archived ? <Badge tone="muted">Retired</Badge> : null}</p>
                      <p className="text-xs text-muted">{e.category}{e.location ? ` · ${e.location}` : ''}{e.serial ? ` · ${e.serial}` : ''}</p>
                    </div>
                    <Badge tone={eqTone[e.status]} dot>{labelFor(EQUIPMENT_STATUSES, e.status)}</Badge>
                  </div>
                  {e.notes ? <p className="text-sm text-muted">{e.notes}</p> : null}
                  <p className="text-xs text-muted">{openByEq.get(e.id) ? <span className="font-medium text-warn">{openByEq.get(e.id)} open incident{openByEq.get(e.id) === 1 ? '' : 's'}</span> : 'No open incidents'}{e.purchasedOn ? ` · bought ${formatDate(e.purchasedOn)}` : ''}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {!e.archived ? <Button size="sm" variant="secondary" icon={<AlertTriangle className="h-4 w-4" aria-hidden />} onClick={() => setReporting(e.id)}>Report</Button> : null}
                    <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing(e)}>Edit</Button>
                    <Button size="sm" variant="ghost" icon={e.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />} onClick={() => act(() => setEquipmentArchived(e.id, e.rev, !e.archived), e.archived ? 'Equipment restored' : 'Equipment retired')}>{e.archived ? 'Restore' : 'Retire'}</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )
      ) : incidents.length === 0 ? (
        <Card><EmptyState icon={<AlertTriangle className="h-5 w-5" aria-hidden />} title={incidentFilter === 'open' ? 'No open incidents' : 'No resolved incidents'} description="Report a problem from an equipment card or the button above." /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {incidents.map((i) => {
              const eq = eqById.get(i.equipmentId)
              return (
                <li key={i.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{i.title}{i.sample ? <SampleBadge /> : null}<Badge tone={sevTone[i.severity]}>{labelFor(INCIDENT_SEVERITIES, i.severity)}</Badge><Badge tone={i.status === 'resolved' ? 'accent' : i.status === 'in_progress' ? 'info' : 'warn'} dot>{labelFor(INCIDENT_STATUSES, i.status)}</Badge></p>
                    <p className="text-xs text-muted">{eq?.name ?? 'Unknown equipment'} · reported {formatDateTime(i.reportedAt, timezone)}{i.reportedBy ? ` by ${i.reportedBy}` : ''}</p>
                    {i.note ? <p className="mt-1 text-sm text-muted">{i.note}</p> : null}
                    {i.resolution ? <p className="mt-1 text-sm"><span className="text-muted">Resolved {formatDateTime(i.resolvedAt, timezone)}:</span> {i.resolution}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {i.status === 'open' ? <Button size="sm" variant="secondary" icon={<Play className="h-4 w-4" aria-hidden />} onClick={() => act(() => setIncidentStatus(i.id, i.rev, 'in_progress'), 'Incident in progress')}>Start work</Button> : null}
                    {i.status !== 'resolved' ? <Button size="sm" icon={<Check className="h-4 w-4" aria-hidden />} onClick={() => setResolving(i)}>Resolve</Button> : <Button size="sm" variant="ghost" onClick={() => act(() => setIncidentStatus(i.id, i.rev, 'open'), 'Incident reopened')}>Reopen</Button>}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {editing ? <EquipmentDialog equipment={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      {reporting ? <IncidentDialog snap={snap.data} presetEquipmentId={reporting === 'any' ? undefined : reporting} onClose={() => setReporting(null)} /> : null}
      {resolving ? <ResolveDialog incident={resolving} equipment={eqById.get(resolving.equipmentId)} onClose={() => setResolving(null)} /> : null}
    </div>
  )
}

function EquipmentDialog({ equipment, onClose }: { equipment?: Equipment; onClose: () => void }) {
  const toast = useToast()
  const form = useForm<{ name: string; category: string; status: EquipmentStatus; location: string; serial: string; purchasedOn: string; notes: string }, EquipmentFormValues>(
    { name: equipment?.name ?? '', category: equipment?.category ?? '', status: equipment?.status ?? 'ok', location: equipment?.location ?? '', serial: equipment?.serial ?? '', purchasedOn: equipment?.purchasedOn ?? '', notes: equipment?.notes ?? '' },
    equipmentForm,
    async (values) => {
      if (equipment) await updateEquipment(equipment.id, equipment.rev, values)
      else await createEquipment(values)
      toast.success(equipment ? 'Equipment updated' : 'Equipment added')
      onClose()
    },
  )
  return (
    <FormModal open onClose={onClose} dirty={form.dirty} saving={form.saving} title={equipment ? `Edit ${equipment.name}` : 'Add equipment'}
      footer={(requestClose) => <><Button variant="secondary" onClick={requestClose} disabled={form.saving}>Cancel</Button><Button onClick={() => form.submit()} loading={form.saving} data-primary>{equipment ? 'Save' : 'Add equipment'}</Button></>}
    >
      <form onSubmit={form.submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={form.errors.name} className="sm:col-span-2">
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={form.values.name} onChange={(e) => form.set('name', e.target.value)} placeholder="e.g. Treadmill 3" autoFocus />}
        </Field>
        <Field label="Category" required error={form.errors.category}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} list="equipment-categories" value={form.values.category} onChange={(e) => form.set('category', e.target.value)} placeholder="Cardio, Strength, Free weights…" />}
        </Field>
        <datalist id="equipment-categories">{['Cardio', 'Strength', 'Free weights', 'Functional', 'Accessories'].map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Condition" required error={form.errors.status}>
          {({ id }) => (
            <Select id={id} value={form.values.status} onChange={(e) => form.set('status', e.target.value as EquipmentStatus)}>
              {EQUIPMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Location" error={form.errors.location}>
          {({ id }) => <Input id={id} value={form.values.location} onChange={(e) => form.set('location', e.target.value)} />}
        </Field>
        <Field label="Serial number" error={form.errors.serial}>
          {({ id }) => <Input id={id} value={form.values.serial} onChange={(e) => form.set('serial', e.target.value)} />}
        </Field>
        <Field label="Purchased on" error={form.errors.purchasedOn}>
          {({ id, invalid }) => <Input id={id} type="date" aria-invalid={invalid} value={form.values.purchasedOn} onChange={(e) => form.set('purchasedOn', e.target.value)} />}
        </Field>
        <Field label="Notes" error={form.errors.notes} className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={2} value={form.values.notes} onChange={(e) => form.set('notes', e.target.value)} />}
        </Field>
        <div className="sm:col-span-2"><FormError message={form.formError} /></div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </FormModal>
  )
}

function IncidentDialog({ snap, presetEquipmentId, onClose }: { snap: Snapshot; presetEquipmentId?: string; onClose: () => void }) {
  const toast = useToast()
  const live = snap.equipment.filter((e) => !e.archived)
  const form = useForm<{ equipmentId: string; title: string; severity: IncidentSeverity; reportedBy: string; note: string; markEquipment: 'keep' | 'needs_service' | 'out_of_order' }, IncidentFormValues>(
    { equipmentId: presetEquipmentId ?? live[0]?.id ?? '', title: '', severity: 'medium', reportedBy: '', note: '', markEquipment: 'needs_service' },
    incidentForm,
    async (values) => {
      await reportIncident(values)
      toast.success('Incident reported')
      onClose()
    },
  )
  return (
    <FormModal open onClose={onClose} dirty={form.dirty} saving={form.saving} title="Report an incident" description="Logs the problem and optionally changes the equipment's condition."
      footer={(requestClose) => <><Button variant="secondary" onClick={requestClose} disabled={form.saving}>Cancel</Button><Button onClick={() => form.submit()} loading={form.saving} data-primary>Report incident</Button></>}
    >
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-4">
        <Field label="Equipment" required error={form.errors.equipmentId}>
          {({ id, invalid }) => (
            <Select id={id} aria-invalid={invalid} value={form.values.equipmentId} onChange={(e) => form.set('equipmentId', e.target.value)} autoFocus={!presetEquipmentId}>
              {live.map((e) => (
                <option key={e.id} value={e.id}>{e.name} · {e.category}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="What is wrong?" required error={form.errors.title}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={form.values.title} onChange={(e) => form.set('title', e.target.value)} placeholder="e.g. Belt slipping at high speed" autoFocus={!!presetEquipmentId} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Severity" required error={form.errors.severity}>
            {({ id }) => (
              <Select id={id} value={form.values.severity} onChange={(e) => form.set('severity', e.target.value as IncidentSeverity)}>
                {INCIDENT_SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reported by" error={form.errors.reportedBy}>
            {({ id }) => <Input id={id} value={form.values.reportedBy} onChange={(e) => form.set('reportedBy', e.target.value)} placeholder="Trainer or staff name" />}
          </Field>
        </div>
        <Field label="Mark equipment as" error={form.errors.markEquipment}>
          {({ id }) => (
            <Select id={id} value={form.values.markEquipment} onChange={(e) => form.set('markEquipment', e.target.value as 'keep' | 'needs_service' | 'out_of_order')}>
              <option value="keep">Leave condition unchanged</option>
              <option value="needs_service">Needs service</option>
              <option value="out_of_order">Out of order</option>
            </Select>
          )}
        </Field>
        <Field label="Details" error={form.errors.note}>
          {({ id }) => <Textarea id={id} rows={3} value={form.values.note} onChange={(e) => form.set('note', e.target.value)} />}
        </Field>
        <FormError message={form.formError} />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </FormModal>
  )
}

function ResolveDialog({ incident, equipment, onClose }: { incident: Incident; equipment?: Equipment; onClose: () => void }) {
  const toast = useToast()
  const [resolution, setResolution] = useState('')
  const [eqStatus, setEqStatus] = useState<EquipmentStatus>('ok')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const go = async () => {
    if (!resolution.trim()) {
      setError('Describe how it was resolved')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setIncidentStatus(incident.id, incident.rev, 'resolved', { resolution, equipmentStatus: eqStatus })
      toast.success('Incident resolved')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={() => !busy && onClose()} title="Resolve incident" description={incident.title} size="sm" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={go} loading={busy} data-primary>Mark resolved</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Resolution" required>
          {({ id }) => <Textarea id={id} rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="What was done" autoFocus />}
        </Field>
        <Field label={`Condition of ${equipment?.name ?? 'equipment'} now`}>
          {({ id }) => (
            <Select id={id} value={eqStatus} onChange={(e) => setEqStatus(e.target.value as EquipmentStatus)}>
              {EQUIPMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          )}
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
