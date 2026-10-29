import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { loadSnapshot, SNAPSHOT_STORES } from '@/data/snapshot'
import { Button, LinkButton } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/EmptyState'
import { PlanDays } from './Workouts'
import { formatDate } from '@/domain/dates'

/** Printable workout sheet, optionally personalised for a member (?member=id). */
export function WorkoutPrintPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { settings, today } = useApp()
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])
  const plan = snap.data?.workouts.find((w) => w.id === id)
  const member = snap.data?.members.find((m) => m.id === params.get('member'))
  useEffect(() => {
    document.title = plan ? `${plan.name} · workout sheet · GymBook` : 'Workout sheet · GymBook'
  }, [plan])
  if (snap.error) return <div className="p-6"><ErrorState message={snap.error} /></div>
  if (!snap.data) return <PageLoading />
  if (!plan) return <div className="mx-auto max-w-lg p-6"><ErrorState title="Plan not found" message="This workout plan does not exist in this browser’s data." action={<Link to="/workouts" className="font-medium underline">Back to workout plans</Link>} /></div>
  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <div className="no-print glass sticky top-0 z-10 border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          <LinkButton to={member ? `/members/${member.id}` : '/workouts'} variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>{member ? member.name : 'Workout plans'}</LinkButton>
          <div className="ml-auto"><Button size="sm" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => window.print()}>Print / save PDF</Button></div>
        </div>
      </div>
      <article className="mx-auto my-4 max-w-3xl rounded-2xl border border-line bg-surface p-6 shadow-card print:my-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none print:text-black sm:p-10">
        <header className="flex flex-col gap-1 border-b border-line pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{settings.gymName} · workout sheet</p>
          <h1 className="text-2xl font-semibold">{plan.name}</h1>
          <p className="text-sm text-muted">{plan.goal}{plan.description ? ` · ${plan.description}` : ''}</p>
          {member ? <p className="mt-2 text-sm"><span className="text-muted">Prepared for</span> <strong>{member.name}</strong>{member.memberCode ? <span className="text-muted"> · {member.memberCode}</span> : null}{member.goal ? <span className="text-muted"> · goal: {member.goal}</span> : null}</p> : null}
          {member?.healthNotes ? <p className="text-sm text-warn">Health notes: {member.healthNotes}</p> : null}
        </header>
        <PlanDays days={plan.days} className="mt-5" />
        <footer className="mt-8 border-t border-line pt-3 text-xs text-muted">Printed {formatDate(today)}. Adjust loads with your trainer; stop any exercise that causes pain.</footer>
      </article>
    </div>
  )
}
