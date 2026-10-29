import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, Trash2 } from 'lucide-react'
import { usePage, useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { listMembers, createMember, updateMember, findPossibleDuplicates, getMember } from '@/data/services/members'
import { listTrainers } from '@/data/services/trainers'
import { memberForm, type MemberFormValues } from '@/domain/validation'
import { useForm } from '@/lib/forms'
import { fileToSmallDataUrl } from '@/lib/image'
import { GENDERS, type Member } from '@/domain/types'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, Input, Select, Textarea, FormError } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Avatar, Banner, PageHeader } from '@/components/ui/misc'
import { PageLoading } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { DiscardGuard } from '@/components/domain/DiscardGuard'
import { errorMessage } from '@/data/errors'

type Values = { name: string; phone: string; email: string; joiningDate: string; trainerId: string; notes: string; photoDataUrl?: string; dateOfBirth: string; gender: '' | 'female' | 'male' | 'other'; emergencyName: string; emergencyPhone: string; goal: string; healthNotes: string }

export function MemberFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const existing = useLiveQuery(() => (mode === 'edit' && id ? getMember(id) : Promise.resolve(undefined)), ['members'], [id, mode])
  usePage(mode === 'new' ? 'Add member' : existing.data ? `Edit ${existing.data.name}` : 'Edit member', mode === 'new' ? 'Create a new member record.' : 'Update member details.', { header: false })

  if (mode === 'edit') {
    if (existing.error) return <ErrorState message={existing.error} />
    if (existing.loading && !existing.data) return <PageLoading />
    if (!existing.data) return <ErrorState title="Member not found" message="This member does not exist in this browser’s data." action={<Link to="/members" className="font-medium underline">Back to members</Link>} />
    return <MemberFormInner key={existing.data.id} mode="edit" member={existing.data} />
  }
  return <MemberFormInner mode="new" />
}

function MemberFormInner({ mode, member }: { mode: 'new' | 'edit'; member?: Member }) {
  const { today } = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const members = useLiveQuery(listMembers, ['members'])
  const trainers = useLiveQuery(listTrainers, ['trainers'])
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const initial = useMemo<Values>(
    () => ({
      name: member?.name ?? '',
      phone: member?.phone ?? '',
      email: member?.email ?? '',
      joiningDate: member?.joiningDate ?? today,
      trainerId: member?.trainerId ?? '',
      notes: member?.notes ?? '',
      photoDataUrl: member?.photoDataUrl,
      dateOfBirth: member?.dateOfBirth ?? '',
      gender: member?.gender ?? '',
      emergencyName: member?.emergencyName ?? '',
      emergencyPhone: member?.emergencyPhone ?? '',
      goal: member?.goal ?? '',
      healthNotes: member?.healthNotes ?? '',
    }),
    [member, today],
  )

  const leaveRef = useRef<() => void>(() => {})
  /** Revision the form was loaded from; saves are checked against it so another tab's change is never overwritten. */
  const baselineRev = useRef(member?.rev ?? 0)
  const form = useForm<Values, MemberFormValues>(initial, memberForm, async (values, { requestKey }) => {
    if (mode === 'edit' && member) {
      await updateMember(member.id, baselineRev.current, values)
      toast.success('Member updated')
      leaveRef.current()
      navigate(`/members/${member.id}`)
    } else {
      const created = await createMember(values, { requestKey: requestKey })
      toast.success(`Added ${created.name}`)
      leaveRef.current()
      navigate(`/members/${created.id}`, { replace: true })
    }
  })

  const { blocker, allowLeave } = useUnsavedChanges(form.dirty)
  leaveRef.current = allowLeave

  // Another tab changed this member. If nothing is being edited, refresh quietly;
  // otherwise keep the person's input and tell them, so no edit is lost silently.
  const changedElsewhere = member !== undefined && member.rev !== baselineRev.current
  const resetRef = useRef(form.reset)
  resetRef.current = form.reset
  useEffect(() => {
    if (!member || member.rev === baselineRev.current) return
    if (!form.dirty) {
      baselineRev.current = member.rev
      resetRef.current(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.rev])
  const reloadLatest = () => {
    if (!member) return
    baselineRev.current = member.rev
    form.reset(initial)
  }

  const duplicates = useMemo(() => {
    if (!members.data) return []
    if (form.values.phone.replace(/\D/g, '').length < 8 && !form.values.email && form.values.name.length < 4) return []
    return findPossibleDuplicates(members.data, { phone: form.values.phone, email: form.values.email, name: form.values.name }, member?.id)
  }, [members.data, form.values.phone, form.values.email, form.values.name, member?.id])

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoError(null)
    try {
      const dataUrl = await fileToSmallDataUrl(file)
      form.set('photoDataUrl', dataUrl)
    } catch (err) {
      setPhotoError(errorMessage(err))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <form onSubmit={form.submit} noValidate className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader back={member ? { to: `/members/${member.id}`, label: member.name } : { to: '/members', label: 'Members' }} title={mode === 'new' ? 'Add member' : `Edit ${member?.name ?? 'member'}`} description={mode === 'new' ? 'Phone and name are required; everything else can be added later.' : 'Changes are saved to this browser only.'} />
      <DiscardGuard blocker={blocker} />
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={form.values.name || 'New member'} src={form.values.photoDataUrl} size="lg" />
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" id="member-photo" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <Button type="button" variant="secondary" size="sm" icon={<Camera className="h-4 w-4" aria-hidden />} onClick={() => fileRef.current?.click()}>
                {form.values.photoDataUrl ? 'Change photo' : 'Add photo'}
              </Button>
              {form.values.photoDataUrl ? (
                <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => form.set('photoDataUrl', undefined)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          {photoError ? <p role="alert" className="text-xs font-medium text-danger">{photoError}</p> : null}
          {form.errors.photoDataUrl ? <p role="alert" className="text-xs font-medium text-danger">{form.errors.photoDataUrl}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={form.errors.name} className="sm:col-span-2">
              {({ id, invalid, describedBy }) => <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} value={form.values.name} onChange={(e) => form.set('name', e.target.value)} autoComplete="off" autoFocus={mode === 'new'} />}
            </Field>
            <Field label="Phone" required error={form.errors.phone}>
              {({ id, invalid, describedBy }) => <Input id={id} type="tel" inputMode="tel" aria-invalid={invalid} aria-describedby={describedBy} value={form.values.phone} onChange={(e) => form.set('phone', e.target.value)} autoComplete="off" />}
            </Field>
            <Field label="Email" error={form.errors.email}>
              {({ id, invalid, describedBy }) => <Input id={id} type="email" inputMode="email" aria-invalid={invalid} aria-describedby={describedBy} value={form.values.email} onChange={(e) => form.set('email', e.target.value)} autoComplete="off" />}
            </Field>
            <Field label="Joining date" required error={form.errors.joiningDate}>
              {({ id, invalid }) => <Input id={id} type="date" aria-invalid={invalid} value={form.values.joiningDate} onChange={(e) => form.set('joiningDate', e.target.value)} />}
            </Field>
            <Field label="Trainer" hint="Optional. Trainers are managed under Trainers." error={form.errors.trainerId}>
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} value={form.values.trainerId} onChange={(e) => form.set('trainerId', e.target.value)}>
                  <option value="">No trainer</option>
                  {(trainers.data ?? [])
                    .filter((t) => t.status === 'active' || t.id === form.values.trainerId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.status === 'archived' ? ' (archived)' : ''}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            <Field label="Notes" error={form.errors.notes} className="sm:col-span-2">
              {({ id }) => <Textarea id={id} value={form.values.notes} onChange={(e) => form.set('notes', e.target.value)} placeholder="Preferred timings, how they found the gym…" />}
            </Field>
          </div>

          <div className="border-t border-line pt-4">
            <h2 className="text-md font-semibold">Profile</h2>
            <p className="mb-3 text-sm text-muted">Optional. Shown on the member’s page and used for workout sheets. Health notes are visible to staff only.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth" error={form.errors.dateOfBirth}>
                {({ id, invalid }) => <Input id={id} type="date" aria-invalid={invalid} value={form.values.dateOfBirth} onChange={(e) => form.set('dateOfBirth', e.target.value)} max={today} />}
              </Field>
              <Field label="Gender" error={form.errors.gender}>
                {({ id }) => (
                  <Select id={id} value={form.values.gender} onChange={(e) => form.set('gender', e.target.value as Values['gender'])}>
                    <option value="">Not recorded</option>
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Emergency contact" error={form.errors.emergencyName}>
                {({ id }) => <Input id={id} value={form.values.emergencyName} onChange={(e) => form.set('emergencyName', e.target.value)} placeholder="Name" autoComplete="off" />}
              </Field>
              <Field label="Emergency phone" error={form.errors.emergencyPhone}>
                {({ id, invalid }) => <Input id={id} type="tel" inputMode="tel" aria-invalid={invalid} value={form.values.emergencyPhone} onChange={(e) => form.set('emergencyPhone', e.target.value)} autoComplete="off" />}
              </Field>
              <Field label="Fitness goal" error={form.errors.goal}>
                {({ id }) => <Input id={id} list="member-goals" value={form.values.goal} onChange={(e) => form.set('goal', e.target.value)} placeholder="Fat loss, Strength, Mobility…" />}
              </Field>
              <datalist id="member-goals">{['Fat loss', 'Strength', 'Muscle gain', 'General fitness', 'Mobility', 'Endurance'].map((g) => <option key={g} value={g} />)}</datalist>
              <Field label="Health notes" hint="Injuries, conditions, medication the trainers should know about." error={form.errors.healthNotes} className="sm:col-span-2">
                {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={2} value={form.values.healthNotes} onChange={(e) => form.set('healthNotes', e.target.value)} />}
              </Field>
            </div>
          </div>

          {changedElsewhere && form.dirty ? (
            <Banner tone="warn" action={<Button type="button" size="sm" variant="secondary" onClick={reloadLatest}>Load latest and discard my edits</Button>}>
              <strong>Changed in another tab.</strong> This member was updated elsewhere while you were editing. Saving now will be refused so nothing is overwritten.
            </Banner>
          ) : null}
          {duplicates.length > 0 ? (
            <Banner tone="warn">
              <strong>Possible duplicate.</strong> {duplicates.length === 1 ? 'A member' : `${duplicates.length} members`} already use this phone, email or name:{' '}
              {duplicates.slice(0, 3).map((d, i) => (
                <span key={d.id}>
                  {i > 0 ? ', ' : ''}
                  <Link to={`/members/${d.id}`} className="font-medium underline">{d.name}</Link>
                </span>
              ))}
              . Family members can share a number, so you can still save.
            </Banner>
          ) : null}
          <FormError message={form.formError} />
        </CardBody>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => navigate(member ? `/members/${member.id}` : '/members')} disabled={form.saving}>
          Cancel
        </Button>
        <Button type="submit" loading={form.saving}>
          {mode === 'new' ? 'Add member' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
