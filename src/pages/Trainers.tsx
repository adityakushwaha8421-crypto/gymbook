import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Dumbbell } from 'lucide-react'
import { usePage } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { loadSnapshot, SNAPSHOT_STORES } from '@/data/snapshot'
import { Card, CardBody } from '@/components/ui/Card'
import { PageActions } from '@/components/ui/PageActions'
import { Button } from '@/components/ui/Button'
import { Avatar, ContactLinks } from '@/components/ui/misc'
import { Badge, SampleBadge } from '@/components/ui/Badge'
import { PageLoading } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { TrainerDialog } from '@/components/domain/TrainerDialog'

export function TrainersPage() {
  usePage('Trainers', 'Manage trainers, their specialties, assigned members and schedules.')
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const assigned = useMemo(() => {
    const m = new Map<string, number>()
    for (const mem of snap.data?.members ?? []) if (mem.trainerId && mem.status !== 'archived') m.set(mem.trainerId, (m.get(mem.trainerId) ?? 0) + 1)
    return m
  }, [snap.data])
  const scheduleCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of snap.data?.schedules ?? []) m.set(s.trainerId, (m.get(s.trainerId) ?? 0) + 1)
    return m
  }, [snap.data])

  if (snap.error) return <ErrorState message={snap.error} />
  if (!snap.data) return <PageLoading />

  const trainers = snap.data.trainers.filter((t) => showArchived || t.status === 'active').sort((a, b) => a.name.localeCompare(b.name))
  const archivedCount = snap.data.trainers.filter((t) => t.status === 'archived').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">A trainer’s schedule is planned availability. Member visits are recorded separately under Attendance.</p>
        <div className="flex flex-wrap items-center gap-2">
          {archivedCount > 0 ? <Button variant="ghost" size="sm" onClick={() => setShowArchived((s) => !s)}>{showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}</Button> : null}
        </div>
      </div>
      <PageActions>
        <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAdding(true)}>Add trainer</Button>
      </PageActions>
      {trainers.length === 0 ? (
        <Card><EmptyState icon={<Dumbbell className="h-5 w-5" aria-hidden />} title="No trainers yet" description="Add trainers to assign members and plan weekly schedules." action={<Button onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" aria-hidden />}>Add trainer</Button>} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((t) => (
            <Card key={t.id} className={t.status === 'archived' ? 'opacity-70' : ''}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={t.name} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/trainers/${t.id}`} className="flex flex-wrap items-center gap-2 font-medium hover:underline">{t.name}{t.sample ? <SampleBadge /> : null}{t.status === 'archived' ? <Badge tone="muted">Archived</Badge> : null}</Link>
                    <p className="text-sm text-muted">{t.specialty}</p>
                  </div>
                </div>
                <ContactLinks phone={t.phone} email={t.email} className="text-sm" />
                <p className="text-xs text-muted">{assigned.get(t.id) ?? 0} assigned member{(assigned.get(t.id) ?? 0) === 1 ? '' : 's'} · {scheduleCount.get(t.id) ?? 0} schedule slot{(scheduleCount.get(t.id) ?? 0) === 1 ? '' : 's'}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      {adding ? <TrainerDialog onClose={() => setAdding(false)} /> : null}
    </div>
  )
}
