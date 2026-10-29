import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import { usePage, useApp } from '@/app/AppContext'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { loadSnapshot, SNAPSHOT_STORES } from '@/data/snapshot'
import { memberRows, type MemberRow } from '@/domain/metrics'
import { formatDate, formatDateTime, compareDates } from '@/domain/dates'
import { formatINR } from '@/domain/money'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { SearchInput, Avatar, Tabs } from '@/components/ui/misc'
import { Table, Th, Td, Tr, RowCard } from '@/components/ui/Table'
import { Pagination, paginate } from '@/components/ui/Pagination'
import { PageLoading } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { MembershipStateBadge } from '@/components/domain/MembershipBadge'
import { SampleBadge, Badge } from '@/components/ui/Badge'
import { filterMembers } from '@/components/domain/MemberPicker'

type Filter = 'all' | 'active' | 'expiring' | 'expired' | 'none' | 'balance' | 'archived'
type SortKey = 'name' | 'joined' | 'expiry' | 'balance' | 'lastVisit'
const PAGE_SIZE = 20

export function MembersPage() {
  usePage('Members', 'Search, filter and manage gym members.')
  const { today, timezone } = useApp()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filter = (params.get('filter') as Filter) || 'all'
  const sort = (params.get('sort') as SortKey) || 'name'
  const dir = params.get('dir') === 'desc' ? 'desc' : 'asc'
  const page = Number(params.get('page') ?? '1') || 1
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const snap = useLiveQuery(loadSnapshot, [...SNAPSHOT_STORES])

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  // Keep the search box local so fast typing never races the URL round-trip; the URL follows after a short pause.
  const [qLocal, setQLocal] = useState(q)
  useEffect(() => {
    setQLocal(q)
  }, [q])

  const rows = useMemo(() => (snap.data ? memberRows(snap.data, today) : []), [snap.data, today])
  const counts = useMemo(() => {
    const live = rows.filter((r) => r.member.status !== 'archived')
    return {
      all: live.length,
      active: live.filter((r) => r.state === 'active' || r.state === 'expiring').length,
      expiring: live.filter((r) => r.state === 'expiring').length,
      expired: live.filter((r) => r.state === 'expired').length,
      none: live.filter((r) => !r.current).length,
      balance: live.filter((r) => r.balancePaise > 0).length,
      archived: rows.filter((r) => r.member.status === 'archived').length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows
    if (filter === 'archived') list = list.filter((r) => r.member.status === 'archived')
    else {
      list = list.filter((r) => r.member.status !== 'archived')
      if (filter === 'active') list = list.filter((r) => r.state === 'active' || r.state === 'expiring')
      if (filter === 'expiring') list = list.filter((r) => r.state === 'expiring')
      if (filter === 'expired') list = list.filter((r) => r.state === 'expired')
      if (filter === 'none') list = list.filter((r) => !r.current)
      if (filter === 'balance') list = list.filter((r) => r.balancePaise > 0)
    }
    list = filterMembers(list, q)
    const cmp = (a: MemberRow, b: MemberRow): number => {
      switch (sort) {
        case 'joined':
          return compareDates(a.member.joiningDate, b.member.joiningDate)
        case 'expiry':
          return (a.current?.endDate ?? '').localeCompare(b.current?.endDate ?? '')
        case 'balance':
          return a.balancePaise - b.balancePaise
        case 'lastVisit':
          return (a.lastVisitAt ?? '').localeCompare(b.lastVisitAt ?? '')
        default:
          return a.member.name.localeCompare(b.member.name)
      }
    }
    return [...list].sort((a, b) => (dir === 'asc' ? cmp(a, b) : cmp(b, a)))
  }, [rows, filter, q, sort, dir])

  const { slice, pageCount, page: safePage } = paginate(filtered, page, PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (sort === key) update({ dir: dir === 'asc' ? 'desc' : 'asc' })
    else update({ sort: key, dir: key === 'balance' || key === 'lastVisit' ? 'desc' : 'asc' })
  }

  if (snap.error) return <ErrorState message={snap.error} />
  if (!snap.data) return <PageLoading />

  const noMembersAtAll = rows.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={qLocal} onChange={(v) => { setQLocal(v); update({ q: v }) }} placeholder="Search name, phone or email" className="sm:w-80" />
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Sort by" value={`${sort}:${dir}`} onChange={(e) => { const [s, d] = e.target.value.split(':'); update({ sort: s, dir: d }) }} className="w-full text-sm sm:w-auto">
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="joined:desc">Newest first</option>
            <option value="joined:asc">Oldest first</option>
            <option value="expiry:asc">Expiry soonest</option>
            <option value="balance:desc">Highest balance</option>
            <option value="lastVisit:desc">Recent visit</option>
          </Select>
        </div>
      </div>
      <Tabs
        value={filter}
        onChange={(f) => update({ filter: f === 'all' ? null : f })}
        items={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'expiring', label: 'Expiring', count: counts.expiring },
          { value: 'expired', label: 'Expired', count: counts.expired },
          { value: 'none', label: 'No plan', count: counts.none },
          { value: 'balance', label: 'Owing', count: counts.balance },
          { value: 'archived', label: 'Archived', count: counts.archived },
        ]}
      />
      <Card>
        {noMembersAtAll ? (
          <EmptyState icon={<Users className="h-5 w-5" aria-hidden />} title="No members yet" description="Add your first member to start selling memberships and recording attendance." action={<LinkButton to="/members/new" icon={<UserPlus className="h-4 w-4" aria-hidden />}>Add member</LinkButton>} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No members match" description={q ? `Nothing matches “${q}” in this filter.` : 'Try another filter.'} />
        ) : isDesktop ? (
          <Table>
            <thead>
              <tr>
                <Th onSort={() => toggleSort('name')} active={sort === 'name'} sort={dir}>Member</Th>
                <Th>Phone</Th>
                <Th onSort={() => toggleSort('expiry')} active={sort === 'expiry'} sort={dir}>Membership</Th>
                <Th onSort={() => toggleSort('balance')} active={sort === 'balance'} sort={dir} className="text-right">Balance</Th>
                <Th onSort={() => toggleSort('lastVisit')} active={sort === 'lastVisit'} sort={dir}>Last visit</Th>
                <Th onSort={() => toggleSort('joined')} active={sort === 'joined'} sort={dir}>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <Tr key={r.member.id} className="cursor-pointer" onClick={() => navigate(`/members/${r.member.id}`)}>
                  <Td>
                    <Link to={`/members/${r.member.id}`} className="flex items-center gap-3 font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      <Avatar name={r.member.name} src={r.member.photoDataUrl} size="sm" />
                      <span className="flex items-center gap-2">
                        {r.member.name}
                        {r.member.sample ? <SampleBadge /> : null}
                        {r.member.status === 'archived' ? <Badge tone="muted">Archived</Badge> : null}
                      </span>
                    </Link>
                  </Td>
                  <Td className="tabular text-muted">{r.member.phone}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <MembershipStateBadge state={r.state} />
                      {r.current ? <span className="text-xs text-muted">{r.current.planName} · {r.state === 'upcoming' ? `from ${formatDate(r.current.startDate)}` : `to ${formatDate(r.current.endDate)}`}</span> : null}
                    </span>
                  </Td>
                  <Td className={`tabular text-right ${r.balancePaise > 0 ? 'font-medium text-danger' : r.balancePaise < 0 ? 'text-info' : 'text-muted'}`}>{r.balancePaise === 0 ? '—' : formatINR(r.balancePaise)}</Td>
                  <Td className="text-muted">{r.lastVisitAt ? formatDateTime(r.lastVisitAt, timezone) : '—'}</Td>
                  <Td className="text-muted">{formatDate(r.member.joiningDate)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div>
            {slice.map((r) => (
              <RowCard key={r.member.id} onClick={() => navigate(`/members/${r.member.id}`)}>
                <div className="flex items-start gap-3">
                  <Avatar name={r.member.name} src={r.member.photoDataUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {r.member.name}
                      {r.member.sample ? <SampleBadge /> : null}
                      {r.member.status === 'archived' ? <Badge tone="muted">Archived</Badge> : null}
                    </p>
                    <p className="tabular text-sm text-muted">{r.member.phone}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <MembershipStateBadge state={r.state} />
                      {r.current ? <span>{r.current.planName} · to {formatDate(r.current.endDate)}</span> : null}
                    </div>
                  </div>
                  {r.balancePaise > 0 ? <span className="tabular shrink-0 text-sm font-medium text-danger">{formatINR(r.balancePaise)}</span> : null}
                </div>
              </RowCard>
            ))}
          </div>
        )}
        <Pagination page={safePage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onChange={(p) => update({ page: String(p) })} />
      </Card>
    </div>
  )
}
