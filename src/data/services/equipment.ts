import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord } from '../repo'
import type { Equipment, Incident, IncidentStatus } from '@/domain/types'
import type { EquipmentFormValues, IncidentFormValues } from '@/domain/validation'
import { DomainError } from '../errors'
import { nowIso } from '@/domain/ids'

export async function listEquipment(): Promise<Equipment[]> {
  return readTx(['equipment'], (tx) => tx.objectStore('equipment').getAll())
}
export async function listIncidents(): Promise<Incident[]> {
  return readTx(['incidents'], (tx) => tx.objectStore('incidents').getAll())
}

export async function createEquipment(values: EquipmentFormValues): Promise<Equipment> {
  return writeTx(['equipment', 'activity'], async (tx) => {
    const e = stampNew('eq', { ...values, archived: false }) as Equipment
    await tx.objectStore('equipment').put(e)
    await logActivity(tx, { kind: 'equipment', message: `Added equipment ${e.name}`, refType: 'equipment', refId: e.id })
    return e
  })
}

export async function updateEquipment(id: string, expectedRev: number, values: EquipmentFormValues): Promise<Equipment> {
  return writeTx(['equipment', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'equipment', id, expectedRev, (e) => ({ ...e, ...values }))
    await logActivity(tx, { kind: 'equipment', message: `Updated equipment ${next.name}`, refType: 'equipment', refId: id })
    return next
  })
}

export async function setEquipmentArchived(id: string, expectedRev: number, archived: boolean): Promise<Equipment> {
  return writeTx(['equipment', 'incidents', 'activity'], async (tx) => {
    if (archived) {
      const open = (await tx.objectStore('incidents').index('equipmentId').getAll(id)).some((i) => i.status !== 'resolved')
      if (open) throw new DomainError('open-incident', 'Resolve this equipment’s open incidents before retiring it.')
    }
    const next = await updateRecord(tx, 'equipment', id, expectedRev, (e) => ({ ...e, archived }))
    await logActivity(tx, { kind: 'equipment', message: `${archived ? 'Retired' : 'Restored'} equipment ${next.name}`, refType: 'equipment', refId: id })
    return next
  })
}

export async function reportIncident(values: IncidentFormValues): Promise<Incident> {
  return writeTx(['equipment', 'incidents', 'activity'], async (tx) => {
    const eq = await tx.objectStore('equipment').get(values.equipmentId)
    if (!eq) throw new DomainError('equipment-missing', 'Equipment not found.')
    if (eq.archived) throw new DomainError('equipment-archived', 'This equipment is retired.')
    const inc = stampNew('inc', {
      equipmentId: eq.id,
      title: values.title,
      severity: values.severity,
      status: 'open' as const,
      reportedAt: nowIso(),
      reportedBy: values.reportedBy,
      note: values.note,
    }) as Incident
    await tx.objectStore('incidents').put(inc)
    if (values.markEquipment !== 'keep') {
      await updateRecord(tx, 'equipment', eq.id, undefined, (e) => ({ ...e, status: values.markEquipment as Equipment['status'] }))
    }
    await logActivity(tx, { kind: 'equipment', message: `Reported ${values.severity} incident on ${eq.name}: ${values.title}`, refType: 'incident', refId: inc.id })
    return inc
  })
}

export async function setIncidentStatus(id: string, expectedRev: number, status: IncidentStatus, opts: { resolution?: string; equipmentStatus?: Equipment['status'] } = {}): Promise<Incident> {
  if (status === 'resolved' && !opts.resolution?.trim()) throw new DomainError('resolution', 'Describe how the incident was resolved.')
  return writeTx(['equipment', 'incidents', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'incidents', id, expectedRev, (i) => ({
      ...i,
      status,
      resolvedAt: status === 'resolved' ? nowIso() : undefined,
      resolution: status === 'resolved' ? opts.resolution?.trim() : i.resolution,
    }))
    const eq = await tx.objectStore('equipment').get(next.equipmentId)
    if (eq && opts.equipmentStatus && eq.status !== opts.equipmentStatus) {
      await updateRecord(tx, 'equipment', eq.id, undefined, (e) => ({ ...e, status: opts.equipmentStatus! }))
    }
    await logActivity(tx, { kind: 'equipment', message: `Incident on ${eq?.name ?? 'equipment'} marked ${status.replace('_', ' ')}: ${next.title}`, refType: 'incident', refId: id })
    return next
  })
}
