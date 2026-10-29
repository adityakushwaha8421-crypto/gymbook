import type { WorkoutDay } from './types'

export interface WorkoutTemplate {
  key: string
  name: string
  goal: string
  description: string
  days: WorkoutDay[]
}

/** Built-in starting points. Using one copies it into the gym's own plans, so edits never change the library. */
export const WORKOUT_LIBRARY: WorkoutTemplate[] = [
  {
    key: 'beginner-full-body',
    name: 'Beginner full body',
    goal: 'General fitness',
    description: 'Three sessions a week, every major muscle group each session. Good first month for new joiners.',
    days: [
      { title: 'Day A', exercises: [{ name: 'Goblet squat', sets: 3, reps: '10' }, { name: 'Push-up (or incline push-up)', sets: 3, reps: '8–12' }, { name: 'Seated cable row', sets: 3, reps: '10' }, { name: 'Dumbbell Romanian deadlift', sets: 3, reps: '10' }, { name: 'Plank', sets: 3, reps: '30 s' }] },
      { title: 'Day B', exercises: [{ name: 'Leg press', sets: 3, reps: '12' }, { name: 'Dumbbell shoulder press', sets: 3, reps: '10' }, { name: 'Lat pulldown', sets: 3, reps: '10' }, { name: 'Walking lunge', sets: 2, reps: '10 each leg' }, { name: 'Dead bug', sets: 3, reps: '8 each side' }] },
      { title: 'Day C', exercises: [{ name: 'Dumbbell bench press', sets: 3, reps: '10' }, { name: 'Hip thrust', sets: 3, reps: '12' }, { name: 'One-arm dumbbell row', sets: 3, reps: '10 each' }, { name: 'Leg curl', sets: 3, reps: '12' }, { name: 'Farmer carry', sets: 3, reps: '30 m' }] },
    ],
  },
  {
    key: 'fat-loss-circuit',
    name: 'Fat-loss circuits',
    goal: 'Fat loss',
    description: 'Four short, high-density sessions. Keep rest between exercises under 45 seconds.',
    days: [
      { title: 'Circuit 1 · Lower', exercises: [{ name: 'Kettlebell swing', sets: 4, reps: '15' }, { name: 'Bodyweight squat', sets: 4, reps: '20' }, { name: 'Reverse lunge', sets: 4, reps: '10 each' }, { name: 'Mountain climber', sets: 4, reps: '30 s' }] },
      { title: 'Circuit 2 · Upper', exercises: [{ name: 'Push-up', sets: 4, reps: '12' }, { name: 'Band row', sets: 4, reps: '15' }, { name: 'Dumbbell thruster', sets: 4, reps: '12' }, { name: 'Battle rope', sets: 4, reps: '30 s' }] },
      { title: 'Circuit 3 · Intervals', exercises: [{ name: 'Rower sprint', sets: 8, reps: '30 s hard / 60 s easy' }, { name: 'Burpee', sets: 4, reps: '10' }] },
      { title: 'Circuit 4 · Full body', exercises: [{ name: 'Goblet squat', sets: 3, reps: '15' }, { name: 'Dumbbell row', sets: 3, reps: '12 each' }, { name: 'Step-up', sets: 3, reps: '10 each' }, { name: 'Plank to push-up', sets: 3, reps: '10' }] },
    ],
  },
  {
    key: 'strength-upper-lower',
    name: 'Strength upper / lower',
    goal: 'Strength',
    description: 'Four days alternating upper and lower body with heavier compound lifts. Add weight when all sets hit the top of the rep range.',
    days: [
      { title: 'Upper 1', exercises: [{ name: 'Barbell bench press', sets: 4, reps: '5' }, { name: 'Barbell row', sets: 4, reps: '6' }, { name: 'Overhead press', sets: 3, reps: '8' }, { name: 'Chin-up', sets: 3, reps: '6–8' }, { name: 'Face pull', sets: 3, reps: '15' }] },
      { title: 'Lower 1', exercises: [{ name: 'Back squat', sets: 4, reps: '5' }, { name: 'Romanian deadlift', sets: 3, reps: '8' }, { name: 'Leg press', sets: 3, reps: '10' }, { name: 'Standing calf raise', sets: 4, reps: '12' }] },
      { title: 'Upper 2', exercises: [{ name: 'Incline dumbbell press', sets: 4, reps: '8' }, { name: 'Lat pulldown', sets: 4, reps: '10' }, { name: 'Dumbbell lateral raise', sets: 3, reps: '15' }, { name: 'Cable triceps press-down', sets: 3, reps: '12' }, { name: 'Dumbbell curl', sets: 3, reps: '12' }] },
      { title: 'Lower 2', exercises: [{ name: 'Deadlift', sets: 4, reps: '4' }, { name: 'Front squat', sets: 3, reps: '6' }, { name: 'Walking lunge', sets: 3, reps: '10 each' }, { name: 'Hanging knee raise', sets: 3, reps: '12' }] },
    ],
  },
  {
    key: 'mobility-recovery',
    name: 'Mobility and recovery',
    goal: 'Mobility',
    description: 'Two gentle sessions for members returning from a break or managing joint pain. Pair with the member’s health notes.',
    days: [
      { title: 'Session 1 · Hips and back', exercises: [{ name: 'Cat–cow', sets: 2, reps: '10' }, { name: '90/90 hip switch', sets: 2, reps: '8 each' }, { name: 'Glute bridge', sets: 3, reps: '12' }, { name: 'Bird dog', sets: 3, reps: '8 each' }, { name: 'Couch stretch', sets: 2, reps: '45 s each' }] },
      { title: 'Session 2 · Shoulders and ankles', exercises: [{ name: 'Wall slide', sets: 3, reps: '10' }, { name: 'Band pull-apart', sets: 3, reps: '15' }, { name: 'Ankle rocker', sets: 2, reps: '12 each' }, { name: 'Thoracic rotation', sets: 2, reps: '8 each' }, { name: 'Easy bike', sets: 1, reps: '10 min' }] },
    ],
  },
]
