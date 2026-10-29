import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input, Field, FormError } from './Field'
import { errorMessage } from '@/data/errors'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** When set, the person must type this exact word to enable confirmation. */
  typeToConfirm?: string
  /** When set, a reason input is shown and passed to onConfirm. */
  reasonLabel?: string
  onConfirm: (reason?: string) => Promise<void> | void
}

export function ConfirmDialog({ open, onClose, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, typeToConfirm, reasonLabel, onConfirm }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canConfirm = (!typeToConfirm || typed === typeToConfirm) && (!reasonLabel || reason.trim().length > 0)

  const handle = async () => {
    if (!canConfirm || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reasonLabel ? reason.trim() : undefined)
      setTyped('')
      setReason('')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return
        setTyped('')
        setReason('')
        setError(null)
        onClose()
      }}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => { setTyped(''); setReason(''); setError(null); onClose() }} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={handle} disabled={!canConfirm} loading={busy} data-primary>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {reasonLabel ? (
          <Field label={reasonLabel} required>
            {({ id }) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
          </Field>
        ) : null}
        {typeToConfirm ? (
          <Field label={`Type ${typeToConfirm} to confirm`} required>
            {({ id }) => <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus={!reasonLabel} />}
          </Field>
        ) : null}
        <FormError message={error} />
      </div>
    </Modal>
  )
}
