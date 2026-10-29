import { useState } from 'react'
import type { Member } from '@/domain/types'
import { checkIn, MembershipRequiredError } from '@/data/services/attendance'
import { useApp } from '@/app/AppContext'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, FormError } from '@/components/ui/Field'
import { errorMessage } from '@/data/errors'

/**
 * Hook that performs a check-in and, when the member has no current
 * membership, opens an override dialog asking for a reason.
 */
export function useCheckIn(onDone?: (member: Member) => void) {
  const { today } = useApp()
  const toast = useToast()
  const [pending, setPending] = useState<{ member: Member; message: string } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (member: Member, overrideReason?: string) => {
    setBusy(true)
    setError(null)
    try {
      await checkIn({ memberId: member.id, today, overrideReason })
      toast.success(`${member.name} checked in`, overrideReason ? 'Entry allowed without an active membership.' : undefined)
      setPending(null)
      setReason('')
      onDone?.(member)
      return true
    } catch (err) {
      if (err instanceof MembershipRequiredError && !overrideReason) {
        setPending({ member, message: err.message })
        return false
      }
      const msg = errorMessage(err)
      if (pending) setError(msg)
      else toast.error('Could not check in', msg)
      return false
    } finally {
      setBusy(false)
    }
  }

  const dialog = (
    <Modal
      open={pending !== null}
      onClose={() => {
        if (busy) return
        setPending(null)
        setReason('')
        setError(null)
      }}
      title="No active membership"
      description={pending?.message}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => { setPending(null); setReason('') }} disabled={busy}>Cancel</Button>
          <Button onClick={() => pending && run(pending.member, reason)} disabled={!reason.trim()} loading={busy} data-primary>
            Allow entry anyway
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Allowing entry records the visit with your reason so it can be reviewed later. It does not extend or create a membership. To avoid this, renew the membership first.</p>
        <Field label="Reason for allowing entry" required>
          {({ id }) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Renewing tomorrow, owner approved" autoFocus />}
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )

  return { checkIn: run, dialog, busy }
}
