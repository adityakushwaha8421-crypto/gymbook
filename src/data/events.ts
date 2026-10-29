export type StoreName =
  | 'members'
  | 'plans'
  | 'memberships'
  | 'invoices'
  | 'adjustments'
  | 'payments'
  | 'attendance'
  | 'trainers'
  | 'schedules'
  | 'expenses'
  | 'followups'
  | 'sessions'
  | 'equipment'
  | 'incidents'
  | 'workouts'
  | 'settings'
  | 'activity'
  | 'counters'

export interface ChangeEvent {
  stores: StoreName[]
  origin: 'local' | 'remote'
}

type Listener = (e: ChangeEvent) => void

const listeners = new Set<Listener>()
const CHANNEL = 'gymbook-changes'
let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (channel) return channel
  if (typeof BroadcastChannel === 'undefined') return null
  channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (ev: MessageEvent<{ stores: StoreName[] }>) => {
    const stores = Array.isArray(ev.data?.stores) ? ev.data.stores : []
    for (const l of listeners) l({ stores, origin: 'remote' })
  }
  return channel
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  getChannel()
  return () => listeners.delete(listener)
}

/** Notify this tab and every other open tab that stores changed. */
export function emitChange(stores: StoreName[]): void {
  for (const l of listeners) l({ stores, origin: 'local' })
  getChannel()?.postMessage({ stores })
}
