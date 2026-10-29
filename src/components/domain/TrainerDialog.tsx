import type { Trainer } from '@/domain/types'
import { trainerForm, type TrainerFormValues } from '@/domain/validation'
import { useForm } from '@/lib/forms'
import { createTrainer, updateTrainer } from '@/data/services/trainers'
import { FormModal } from './FormModal'
import { Field, Input, Textarea, FormError } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export function TrainerDialog({ trainer, onClose, onCreated }: { trainer?: Trainer; onClose: () => void; onCreated?: (t: Trainer) => void }) {
  const toast = useToast()
  const form = useForm<{ name: string; phone: string; email: string; specialty: string; notes: string }, TrainerFormValues>(
    { name: trainer?.name ?? '', phone: trainer?.phone ?? '', email: trainer?.email ?? '', specialty: trainer?.specialty ?? '', notes: trainer?.notes ?? '' },
    trainerForm,
    async (values) => {
      if (trainer) {
        await updateTrainer(trainer.id, trainer.rev, values)
        toast.success('Trainer updated')
      } else {
        const t = await createTrainer(values)
        toast.success(`Added ${t.name}`)
        onCreated?.(t)
      }
      onClose()
    },
  )
  return (
    <FormModal open onClose={onClose} dirty={form.dirty} saving={form.saving} title={trainer ? `Edit ${trainer.name}` : 'Add trainer'}
      footer={(requestClose) => <><Button variant="secondary" onClick={requestClose} disabled={form.saving}>Cancel</Button><Button onClick={() => form.submit()} loading={form.saving} data-primary>{trainer ? 'Save changes' : 'Add trainer'}</Button></>}
    >
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-4">
        <Field label="Full name" required error={form.errors.name}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={form.values.name} onChange={(e) => form.set('name', e.target.value)} autoFocus />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" required error={form.errors.phone}>
            {({ id, invalid }) => <Input id={id} type="tel" aria-invalid={invalid} value={form.values.phone} onChange={(e) => form.set('phone', e.target.value)} />}
          </Field>
          <Field label="Email" error={form.errors.email}>
            {({ id, invalid }) => <Input id={id} type="email" aria-invalid={invalid} value={form.values.email} onChange={(e) => form.set('email', e.target.value)} />}
          </Field>
        </div>
        <Field label="Specialty" required error={form.errors.specialty}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={form.values.specialty} onChange={(e) => form.set('specialty', e.target.value)} placeholder="e.g. Strength, Yoga, CrossFit" />}
        </Field>
        <Field label="Notes" error={form.errors.notes}>
          {({ id }) => <Textarea id={id} rows={2} value={form.values.notes} onChange={(e) => form.set('notes', e.target.value)} />}
        </Field>
        <FormError message={form.formError} />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </FormModal>
  )
}
