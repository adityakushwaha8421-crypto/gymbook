import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord } from '../repo'
import type { Plan } from '@/domain/types'
import type { PlanFormValues } from '@/domain/validation'

export async function listPlans(): Promise<Plan[]> {
  return readTx(['plans'], (tx) => tx.objectStore('plans').getAll())
}

export async function createPlan(values: PlanFormValues): Promise<Plan> {
  return writeTx(['plans', 'activity'], async (tx) => {
    const plan = stampNew('plan', {
      name: values.name,
      durationValue: values.durationValue,
      durationUnit: values.durationUnit,
      pricePaise: values.price,
      description: values.description,
      archived: false,
    }) as Plan
    await tx.objectStore('plans').put(plan)
    await logActivity(tx, { kind: 'membership', message: `Created plan ${plan.name}`, refType: 'plan', refId: plan.id })
    return plan
  })
}

export async function updatePlan(id: string, expectedRev: number, values: PlanFormValues): Promise<Plan> {
  return writeTx(['plans', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'plans', id, expectedRev, (p) => ({
      ...p,
      name: values.name,
      durationValue: values.durationValue,
      durationUnit: values.durationUnit,
      pricePaise: values.price,
      description: values.description,
    }))
    await logActivity(tx, { kind: 'membership', message: `Updated plan ${next.name}`, refType: 'plan', refId: id })
    return next
  })
}

export async function setPlanArchived(id: string, expectedRev: number, archived: boolean): Promise<Plan> {
  return writeTx(['plans', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'plans', id, expectedRev, (p) => ({ ...p, archived }))
    await logActivity(tx, { kind: 'membership', message: `${archived ? 'Archived' : 'Restored'} plan ${next.name}`, refType: 'plan', refId: id })
    return next
  })
}
