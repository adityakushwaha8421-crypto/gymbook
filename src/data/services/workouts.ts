import { readTx, writeTx } from '../db'
import { logActivity, stampNew, updateRecord } from '../repo'
import type { WorkoutPlan } from '@/domain/types'
import type { WorkoutFormValues } from '@/domain/validation'
import { WORKOUT_LIBRARY } from '@/domain/workoutLibrary'
import { DomainError } from '../errors'

export async function listWorkouts(): Promise<WorkoutPlan[]> {
  return readTx(['workouts'], (tx) => tx.objectStore('workouts').getAll())
}

export async function createWorkout(values: WorkoutFormValues, source: 'library' | 'custom' = 'custom'): Promise<WorkoutPlan> {
  return writeTx(['workouts', 'activity'], async (tx) => {
    const w = stampNew('wk', { ...values, source, archived: false }) as WorkoutPlan
    await tx.objectStore('workouts').put(w)
    await logActivity(tx, { kind: 'workout', message: `Created workout plan ${w.name}`, refType: 'workout', refId: w.id })
    return w
  })
}

/** Copy a library template into the gym's own plans. */
export async function createWorkoutFromTemplate(key: string): Promise<WorkoutPlan> {
  const t = WORKOUT_LIBRARY.find((x) => x.key === key)
  if (!t) throw new DomainError('template-missing', 'Template not found.')
  return createWorkout({ name: t.name, goal: t.goal, description: t.description, days: t.days.map((d) => ({ title: d.title, exercises: d.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, note: e.note })) })) }, 'library')
}

export async function updateWorkout(id: string, expectedRev: number, values: WorkoutFormValues): Promise<WorkoutPlan> {
  return writeTx(['workouts', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'workouts', id, expectedRev, (w) => ({ ...w, ...values }))
    await logActivity(tx, { kind: 'workout', message: `Updated workout plan ${next.name}`, refType: 'workout', refId: id })
    return next
  })
}

export async function setWorkoutArchived(id: string, expectedRev: number, archived: boolean): Promise<WorkoutPlan> {
  return writeTx(['workouts', 'activity'], async (tx) => {
    const next = await updateRecord(tx, 'workouts', id, expectedRev, (w) => ({ ...w, archived }))
    await logActivity(tx, { kind: 'workout', message: `${archived ? 'Archived' : 'Restored'} workout plan ${next.name}`, refType: 'workout', refId: id })
    return next
  })
}

/** Assign (or clear with null) a plan on a member. */
export async function assignWorkout(memberId: string, expectedRev: number, workoutId: string | null): Promise<void> {
  return writeTx(['members', 'workouts', 'activity'], async (tx) => {
    let name: string | undefined
    if (workoutId) {
      const w = await tx.objectStore('workouts').get(workoutId)
      if (!w) throw new DomainError('workout-missing', 'Workout plan not found.')
      if (w.archived) throw new DomainError('workout-archived', 'This plan is archived.')
      name = w.name
    }
    const member = await updateRecord(tx, 'members', memberId, expectedRev, (m) => ({ ...m, workoutPlanId: workoutId ?? undefined }))
    await logActivity(tx, { kind: 'workout', message: workoutId ? `Assigned ${name} to ${member.name}` : `Cleared the workout plan for ${member.name}`, memberId, refType: 'member', refId: memberId })
  })
}
