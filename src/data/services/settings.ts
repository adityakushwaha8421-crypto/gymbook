import { readTx, writeTx } from '../db'
import { DEFAULT_TIMEZONE } from '@/domain/dates'
import { nowIso } from '@/domain/ids'
import type { Settings } from '@/domain/types'
import { StorageError } from '../errors'
import { BRAND } from '@/brand'

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  rev: 0,
  updatedAt: '1970-01-01T00:00:00.000Z',
  gymName: BRAND.name,
  logoDataUrl: BRAND.logoDataUrl,
  address: BRAND.address,
  phone: BRAND.phone,
  email: '',
  currency: 'INR',
  timezone: DEFAULT_TIMEZONE,
  invoicePrefix: BRAND.invoicePrefix,
  invoiceFooter: 'Thank you for training with us.',
  dataMode: 'unset',
}

export async function getSettings(): Promise<Settings> {
  const s = await readTx(['settings'], (tx) => tx.objectStore('settings').get('settings'))
  return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id' | 'rev' | 'updatedAt'>>, expectedRev?: number): Promise<Settings> {
  return writeTx(['settings'], async (tx) => {
    const current = (await tx.objectStore('settings').get('settings')) ?? DEFAULT_SETTINGS
    if (expectedRev !== undefined && current.rev !== expectedRev) {
      throw new StorageError('conflict', 'Settings were changed in another tab. Reload to see the latest version, then try again.')
    }
    const next: Settings = { ...current, ...patch, id: 'settings', rev: current.rev + 1, updatedAt: nowIso() }
    await tx.objectStore('settings').put(next)
    return next
  })
}
