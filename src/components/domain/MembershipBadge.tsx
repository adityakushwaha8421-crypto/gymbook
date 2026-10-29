import { Badge, type Tone } from '@/components/ui/Badge'
import type { MembershipState } from '@/domain/membership'
import type { InvoiceBalance } from '@/domain/membership'

const map: Record<MembershipState, { tone: Tone; label: string }> = {
  active: { tone: 'accent', label: 'Active' },
  expiring: { tone: 'warn', label: 'Expiring soon' },
  expired: { tone: 'danger', label: 'Expired' },
  upcoming: { tone: 'info', label: 'Starts later' },
  cancelled: { tone: 'muted', label: 'Cancelled' },
}

export function MembershipStateBadge({ state }: { state?: MembershipState }) {
  if (!state) return <Badge tone="muted">No membership</Badge>
  const m = map[state]
  return <Badge tone={m.tone}>{m.label}</Badge>
}

const payMap: Record<InvoiceBalance['status'], { tone: Tone; label: string }> = {
  paid: { tone: 'accent', label: 'Paid' },
  partial: { tone: 'warn', label: 'Partly paid' },
  unpaid: { tone: 'danger', label: 'Unpaid' },
  void: { tone: 'muted', label: 'Void' },
  credit: { tone: 'info', label: 'Overpaid' },
}

export function PaymentStatusBadge({ status }: { status: InvoiceBalance['status'] }) {
  const m = payMap[status]
  return <Badge tone={m.tone}>{m.label}</Badge>
}
