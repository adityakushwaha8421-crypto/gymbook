import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, Receipt, Activity, TrendingUp, TrendingDown, Minus, UserPlus, CreditCard, ArrowRight } from 'lucide-react'
import { PageActions } from '@/components/ui/PageActions'
import { usePage, useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { loadSnapshot, SNAPSHOT_STORES } from '@/data/snapshot'
import { listRecentActivity } from '@/data/services/activity'
import { dashboardMetrics, financeSeries, financeSummary, periodPreset, monthComparison, type Period, type MemberRow } from '@/domain/metrics'
import { formatINRCompact, formatINR } from '@/domain/money'
import { formatDate, formatDateTime, diffDays, formatMonthKey } from '@/domain/dates'
import { Avatar, LiveDot } from '@/components/ui/misc'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/Spinner'
import { ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { BarChart } from '@/components/charts/BarChart'
import { PeriodPicker, type PresetName } from '@/components/domain/PeriodPicker'
import { SampleBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

/** One line on the board: who, why, and the number that counts down. */
interface BoardRow {
  row: MemberRow
  /** red: money pending; amber: plan ending within 7 days; faint: lapsed in the last 30 days */
  tone: 'due' | 'ending' | 'lapsed'
  figure: string
  caption: string
  why: string
}

function boardRows(m: ReturnType<typeof dashboardMetrics>, today: string): BoardRow[] {
  const out: BoardRow[] = []
  const seen = new Set<string>()
  const endsIn = (r: MemberRow) => (r.current ? diffDays(today, r.current.endDate) : null)
  for (const r of m.owing) {
    seen.add(r.member.id)
    const d = r.state === 'expiring' ? endsIn(r) : null
    const plan = r.current?.planName ?? 'No plan'
    out.push({
      row: r,
      tone: 'due',
      figure: formatINRCompact(r.balancePaise),
      caption: 'pending',
      why: d !== null ? `${plan} · ends ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}` : plan,
    })
  }
  for (const r of m.expiringSoon) {
    if (seen.has(r.member.id)) continue
    seen.add(r.member.id)
    const d = endsIn(r) ?? 0
    out.push({ row: r, tone: 'ending', figure: d === 0 ? 'Today' : `${d} d`, caption: 'ending', why: `${r.current?.planName} · ends ${formatDate(r.current!.endDate)}` })
  }
  for (const r of m.expiredRecently) {
    if (seen.has(r.member.id)) continue
    seen.add(r.member.id)
    const ago = diffDays(r.current!.endDate, today)
    out.push({ row: r, tone: 'lapsed', figure: `${ago} d`, caption: 'lapsed', why: `${r.current?.planName} · ended ${formatDate(r.current!.endDate)}` })
  }
  return out
}

export function Dashboard() {
  // Phones open straight onto the board; the page title is for wide screens.
  usePage('Dashboard', undefined, { header: 'desktop' })
  const { today, timezone, settings } = useApp()
  const isDesktop = useIsDesktop()
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])
  const activity = useLiveQuery(() => listRecentActivity(8), 'all')
  const [preset, setPreset] = useState<PresetName>('30d')
  const [period, setPeriod] = useState<Period>(() => periodPreset('30d', today))

  const metrics = useMemo(() => (snap.data ? dashboardMetrics(snap.data, today, timezone) : null), [snap.data, today, timezone])
  const finance = useMemo(() => (snap.data ? financeSummary(snap.data, period, timezone) : null), [snap.data, period, timezone])
  const series = useMemo(() => (snap.data ? financeSeries(snap.data, period, timezone) : null), [snap.data, period, timezone])
  const mom = useMemo(() => (snap.data ? monthComparison(snap.data, today, timezone) : null), [snap.data, today, timezone])
  const board = useMemo(() => (metrics ? boardRows(metrics, today) : []), [metrics, today])

  if (snap.error) return <ErrorState message={snap.error} />
  if (!snap.data || !metrics || !finance || !series || !mom) return <PageLoading />

  const labels = series.points.map((p) => (series.granularity === 'day' ? p.key.slice(8) + '/' + p.key.slice(5, 7) : formatMonthKey(p.key)))
  const firstRun = metrics.totalMembers === 0
  const hasPlans = snap.data.plans.some((p) => !p.archived)
  const dueCount = metrics.membersWithBalance
  const [yy, mm, dd] = today.split('-').map(Number)
  const todayLabel = new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <div className="flex flex-col gap-6 pb-20 lg:pb-0">
      {isDesktop ? (
        <PageActions>
          <LinkButton to="/attendance?action=checkin" variant="secondary" icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}>
            Check in
          </LinkButton>
          <LinkButton to="/payments?action=record" icon={<Receipt className="h-4 w-4" aria-hidden />}>
            Record payment
          </LinkButton>
        </PageActions>
      ) : null}

      <div className="flex items-baseline justify-between gap-3 text-sm text-muted lg:-mt-6">
        <span>{todayLabel}</span>
        {settings.dataMode === 'sample' ? (
          <Link to="/settings#data" className="lg:hidden" title="Labelled sample data is loaded. Records marked “Sample” are not real.">Sample data</Link>
        ) : null}
      </div>

      {firstRun ? (
        <FirstRun hasPlans={hasPlans} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* The board */}
          <section aria-labelledby="board-title" className="min-w-0 lg:col-span-2">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 id="board-title" className="text-lg font-semibold">Due next</h2>
              <p className="text-sm text-muted">
                {dueCount > 0 ? <><span className="text-danger">{dueCount} owe {formatINRCompact(metrics.outstandingPaise)}</span>{metrics.expiringSoon.length ? ' · ' : ''}</> : null}
                {metrics.expiringSoon.length > 0 ? <span className="text-warn">{metrics.expiringSoon.length} ending this week</span> : null}
                {dueCount === 0 && metrics.expiringSoon.length === 0 ? 'All clear' : null}
              </p>
            </div>
            <Card>
              {board.length === 0 ? (
                <EmptyState
                  compact
                  title="Nothing due"
                  description="Everyone is paid up and no plan ends in the next 7 days. Members whose fee is pending or plan is ending will appear here."
                  action={<LinkButton to="/members" variant="secondary" size="sm">Open members</LinkButton>}
                />
              ) : (
                <ol className="divide-y divide-line">
                  {board.slice(0, isDesktop ? 10 : 5).map((b) => (
                    <li key={b.row.member.id}>
                      <Link to={`/members/${b.row.member.id}${b.tone === 'due' ? '?tab=payments' : ''}`} className="pressable group flex min-h-[52px] items-center gap-3 px-4 py-1.5 hover:bg-raised sm:px-5">
                        <Avatar name={b.row.member.name} src={b.row.member.photoDataUrl} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-md font-medium leading-5">{b.row.member.name}</span>
                          <span className="flex min-w-0 items-center gap-2 text-sm leading-4 text-muted">
                            <span className="min-w-0 truncate">{b.why}</span>
                            {b.row.member.sample ? <SampleBadge /> : null}
                          </span>
                        </span>
                        <span className={cn('shrink-0 text-right', b.tone === 'due' ? 'text-danger' : b.tone === 'ending' ? 'text-warn' : 'text-muted')}>
                          <span className="led block text-[24px]">{b.figure}</span>
                          <span className="mt-0.5 block text-2xs font-medium uppercase leading-3 tracking-[0.08em] opacity-90">{b.caption}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              {board.length > (isDesktop ? 10 : 5) ? (
                <div className="border-t border-line px-4 py-2.5 text-sm sm:px-5">
                  <Link to="/members?filter=balance" className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink hover:underline">
                    {board.length - (isDesktop ? 10 : 5)} more on the Members page
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              ) : null}
            </Card>

            {/* Today's figures: one strip, hairlines between, never four cards. */}
            <Card className="mt-3 grid grid-cols-2 lg:grid-cols-4" aria-label="Today">
              <Cell to="/members?filter=balance" label="Outstanding" figure={formatINRCompact(metrics.outstandingPaise)} tone={metrics.outstandingPaise > 0 ? 'danger' : undefined} hint={`${metrics.membersWithBalance} member${metrics.membersWithBalance === 1 ? '' : 's'} owe money`} className="border-b border-r border-line lg:border-b-0" />
              <Cell to="/payments?tab=payments" label="Received today" figure={formatINRCompact(metrics.receivedTodayPaise)} hint={`${metrics.paymentsToday} payment${metrics.paymentsToday === 1 ? '' : 's'}`} className="border-b border-line lg:border-b-0 lg:border-r" />
              <Cell to="/attendance" label="Attendance today" figure={String(metrics.attendanceToday)} live={metrics.checkedInNow > 0} hint={`${metrics.checkedInNow} in the gym now`} className="border-r border-line" />
              <Cell to="/members?filter=active" label="Active members" figure={String(metrics.activeMembers)} hint={`${metrics.totalMembers} members in total`} />
            </Card>
          </section>

          <section aria-label="This month" className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader title="This month so far" description="Against the same days last month" />
              <ul className="divide-y divide-line">
                <Delta label="Cash received" now={mom.received[0]} prev={mom.received[1]} fmt={formatINRCompact} />
                <Delta label="New members" now={mom.newMembers[0]} prev={mom.newMembers[1]} fmt={String} />
                <Delta label="Visits" now={mom.visits[0]} prev={mom.visits[1]} fmt={String} />
              </ul>
            </Card>
            <Card className="hidden lg:block">
              <CardHeader title="Recent activity" action={<Link to="/activity" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink hover:underline">All activity<ArrowRight className="h-4 w-4" aria-hidden /></Link>} />
              <ActivityList items={activity.data} timezone={timezone} />
            </Card>
          </section>
        </div>
      )}

      {!firstRun ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Money"
              description="Cash received is what came in; invoiced is what was billed."
              action={<PeriodPicker preset={preset} period={period} today={today} onChange={(p, per) => { setPreset(p); setPeriod(per) }} />}
            />
            <CardBody className="flex flex-col gap-5">
              <dl className="grid grid-cols-2 divide-x divide-line">
                <MoneyCell label="Cash received" value={finance.receivedPaise} hint={`${finance.paymentsCount} payment${finance.paymentsCount === 1 ? '' : 's'}`} />
                <MoneyCell label="Invoiced" value={finance.invoicedPaise} hint={`${finance.invoicesCount} invoice${finance.invoicesCount === 1 ? '' : 's'}`} className="pl-5" />
              </dl>
              <BarChart
                labels={labels}
                series={[{ key: 'received', label: 'Cash received', color: 'rgb(var(--c-success))', values: series.points.map((p) => p.received), format: formatINR }]}
                height={240}
              />
            </CardBody>
          </Card>
          <Card className="lg:hidden">
            <CardHeader title="Recent activity" action={<Link to="/activity" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink hover:underline">All activity<ArrowRight className="h-4 w-4" aria-hidden /></Link>} />
            <ActivityList items={activity.data} timezone={timezone} />
          </Card>
        </div>
      ) : null}

      {/* Phones: the two desk actions stay in reach above the tab bar. */}
      {!isDesktop && !firstRun ? (
        <div className="no-print fixed inset-x-0 z-20 px-4 lg:hidden" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex max-w-md gap-2">
            <LinkButton to="/attendance?action=checkin" variant="secondary" size="lg" className="surface-pop flex-1 shadow-pop" icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}>
              Check in
            </LinkButton>
            <LinkButton to="/payments?action=record" size="lg" className="flex-1 shadow-pop" icon={<Receipt className="h-4 w-4" aria-hidden />}>
              Record payment
            </LinkButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Cell({ to, label, figure, hint, live, tone, className }: { to: string; label: string; figure: string; hint?: string; live?: boolean; tone?: 'danger'; className?: string }) {
  return (
    <Link to={to} className={cn('pressable block min-w-0 px-4 py-3.5 hover:bg-raised sm:px-5 sm:py-4', className)}>
      <p className="truncate text-sm text-muted">{label}</p>
      <p className={cn('led mt-2 truncate text-[26px] sm:text-[28px]', tone === 'danger' && 'text-danger')}>{figure}</p>
      {hint ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          {live ? <LiveDot /> : null}
          <span className="truncate">{hint}</span>
        </p>
      ) : null}
    </Link>
  )
}

function ActivityList({ items, timezone }: { items: { id: string; message: string; at: string; memberId?: string | null }[] | undefined; timezone: string }) {
  if (items && items.length === 0) {
    return <EmptyState compact icon={<Activity className="h-5 w-5" aria-hidden />} title="No activity yet" description="Adding members, selling memberships and recording payments will show here" />
  }
  return (
    <ul className="divide-y divide-line">
      {(items ?? []).map((a) => (
        <li key={a.id} className="px-4 py-2.5 sm:px-5">
          <p className="break-words text-sm">
            {a.memberId ? (
              <Link to={`/members/${a.memberId}`} className="hover:underline">
                {a.message}
              </Link>
            ) : (
              a.message
            )}
          </p>
          <p className="text-xs text-muted">{formatDateTime(a.at, timezone)}</p>
        </li>
      ))}
    </ul>
  )
}

/** An empty gym: three steps in order, instead of four zeros and an empty chart. */
function FirstRun({ hasPlans }: { hasPlans: boolean }) {
  const steps = [
    { done: hasPlans, title: 'Create your membership plans', body: 'Monthly, quarterly, yearly: name, price and duration.', to: '/plans', cta: 'Plans', icon: CreditCard },
    { done: false, title: 'Add your first member', body: 'Name and phone are enough; choose a plan and the invoice is made for you.', to: '/members/new', cta: 'Add member', icon: UserPlus },
    { done: false, title: 'Check someone in', body: 'Search by name or phone; the board shows who is in the gym.', to: '/attendance', cta: 'Attendance', icon: ClipboardCheck },
  ]
  return (
    <Card>
      <CardHeader title="Set up the desk" description="Three steps, in order. The board takes over once there are members." />
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-4 px-5 py-4">
            <span className={cn('led w-7 shrink-0 text-[26px]', s.done ? 'text-success' : i === steps.findIndex((x) => !x.done) ? 'text-ink' : 'text-faint')}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-md font-medium', s.done && 'text-muted line-through')}>{s.title}</span>
              <span className="block text-sm text-muted">{s.body}</span>
            </span>
            {!s.done ? <LinkButton to={s.to} variant={i === steps.findIndex((x) => !x.done) ? 'primary' : 'secondary'} size="sm" icon={<s.icon className="h-4 w-4" aria-hidden />}>{s.cta}</LinkButton> : null}
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Delta({ label, now, prev, fmt }: { label: string; now: number; prev: number; fmt: (v: number) => string }) {
  const pct = prev === 0 ? (now === 0 ? 0 : null) : Math.round(((now - prev) / prev) * 100)
  const up = now > prev
  const same = now === prev
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">last month {fmt(prev)}</p>
      </div>
      <div className="text-right">
        <p className="tabular text-base font-medium">{fmt(now)}</p>
        <p className={`flex items-center justify-end gap-1 text-xs ${same ? 'text-muted' : up ? 'text-success' : 'text-danger'}`}>
          {same ? <Minus className="h-3 w-3" aria-hidden /> : up ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
          {pct === null ? 'new' : `${pct > 0 ? '+' : ''}${pct}%`}
        </p>
      </div>
    </li>
  )
}

function MoneyCell({ label, value, hint, className }: { label: string; value: number; hint?: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular mt-1 text-xl font-semibold leading-7 [overflow-wrap:anywhere]">{formatINR(value)}</dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  )
}
