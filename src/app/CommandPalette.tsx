import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, CreditCard, ClipboardCheck, Receipt, Dumbbell, Wallet, BellRing, BarChart3, Settings, UserPlus, Search, SunMoon, CornerDownLeft, CalendarClock, Wrench, NotebookPen, Activity, AlertTriangle, type LucideIcon } from 'lucide-react'
import { listMembers } from '@/data/services/members'
import type { Member } from '@/domain/types'
import { normalizePhone } from '@/domain/validation'
import { Avatar } from '@/components/ui/misc'
import { Kbd } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { fadeReduced, springDefault } from '@/lib/motion'

interface Command {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  group: 'Actions' | 'Go to'
  run: () => void
  keys?: string
}

export function CommandPalette({ open, onClose, onToggleTheme }: { open: boolean; onClose: () => void; onToggleTheme: () => void }) {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) {
      const opener = openerRef.current
      if (opener) {
        const id = setTimeout(() => {
          if (document.activeElement === document.body && opener.isConnected) opener.focus({ preventScroll: true })
        }, 50)
        return () => clearTimeout(id)
      }
      return
    }
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setActive(0)
    listMembers()
      .then((m) => setMembers(m.filter((x) => x.status !== 'archived')))
      .catch(() => setMembers([]))
  }, [open])

  const go = (to: string) => () => {
    onClose()
    navigate(to)
  }

  const commands = useMemo<Command[]>(
    () => [
      { id: 'new-member', label: 'Add member', icon: UserPlus, group: 'Actions', run: go('/members/new'), keys: 'N' },
      { id: 'checkin', label: 'Check in a member', icon: ClipboardCheck, group: 'Actions', run: go('/attendance?action=checkin') },
      { id: 'payment', label: 'Record a payment', icon: Receipt, group: 'Actions', run: go('/payments?action=record') },
      { id: 'book', label: 'Book a PT session', icon: CalendarClock, group: 'Actions', run: go('/sessions') },
      { id: 'incident', label: 'Report an equipment incident', icon: AlertTriangle, group: 'Actions', run: go('/equipment') },
      { id: 'theme', label: 'Toggle light / dark theme', icon: SunMoon, group: 'Actions', run: () => { onClose(); onToggleTheme() } },
      { id: 'g-d', label: 'Dashboard', icon: LayoutDashboard, group: 'Go to', run: go('/'), keys: 'G D' },
      { id: 'g-m', label: 'Members', icon: Users, group: 'Go to', run: go('/members'), keys: 'G M' },
      { id: 'g-p', label: 'Plans', icon: CreditCard, group: 'Go to', run: go('/plans'), keys: 'G P' },
      { id: 'g-a', label: 'Attendance', icon: ClipboardCheck, group: 'Go to', run: go('/attendance'), keys: 'G A' },
      { id: 'g-y', label: 'Payments & invoices', icon: Receipt, group: 'Go to', run: go('/payments'), keys: 'G Y' },
      { id: 'g-t', label: 'Trainers', icon: Dumbbell, group: 'Go to', run: go('/trainers'), keys: 'G T' },
      { id: 'g-e', label: 'Expenses', icon: Wallet, group: 'Go to', run: go('/expenses'), keys: 'G E' },
      { id: 'g-f', label: 'Follow-ups', icon: BellRing, group: 'Go to', run: go('/follow-ups'), keys: 'G F' },
      { id: 'g-r', label: 'Reports', icon: BarChart3, group: 'Go to', run: go('/reports'), keys: 'G R' },
      { id: 'g-c', label: 'PT sessions', icon: CalendarClock, group: 'Go to', run: go('/sessions'), keys: 'G C' },
      { id: 'g-w', label: 'Workout plans', icon: NotebookPen, group: 'Go to', run: go('/workouts'), keys: 'G W' },
      { id: 'g-q', label: 'Equipment', icon: Wrench, group: 'Go to', run: go('/equipment'), keys: 'G Q' },
      { id: 'g-l', label: 'Activity log', icon: Activity, group: 'Go to', run: go('/activity'), keys: 'G L' },
      { id: 'g-s', label: 'Settings', icon: Settings, group: 'Go to', run: go('/settings'), keys: 'G S' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onToggleTheme],
  )

  const q = query.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  const matchedMembers = q
    ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || (digits.length >= 3 && normalizePhone(m.phone).includes(digits))).slice(0, 6)
    : []
  const matchedCommands = q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands
  type Row = { kind: 'member'; member: Member } | { kind: 'command'; command: Command }
  const rows: Row[] = [...matchedMembers.map((member) => ({ kind: 'member' as const, member })), ...matchedCommands.map((command) => ({ kind: 'command' as const, command }))]

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const runRow = (row: Row | undefined) => {
    if (!row) return
    if (row.kind === 'member') go(`/members/${row.member.id}`)()
    else row.command.run()
  }

  let lastGroup = ''

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeReduced} />
            </Dialog.Overlay>
            <Dialog.Content
              forceMount
              aria-label="Command palette"
              className="fixed inset-x-4 top-[10vh] z-[60] mx-auto max-w-xl focus:outline-none sm:top-[14vh]"
              onCloseAutoFocus={(e) => {
                // Radix would focus the body once the exit animation unmounts us; send focus back to the opener instead.
                e.preventDefault()
                const opener = openerRef.current
                if (opener?.isConnected) opener.focus({ preventScroll: true })
              }}
              onKeyDown={(e) => {
                // The search box is the only tabbable control, so Tab always stays on it.
                if (e.key === 'Tab') {
                  e.preventDefault()
                  inputRef.current?.focus()
                }
              }}
            >
              <motion.div
                className="glass-pop overflow-hidden rounded-3xl"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -4 }}
                transition={reduced ? fadeReduced : springDefault}
              >
                <Dialog.Title className="sr-only">Command palette</Dialog.Title>
                <Dialog.Description className="sr-only">Search members or jump to a page</Dialog.Description>
                <div className="flex items-center gap-2 border-b border-line/70 px-4">
                  <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                  <input
                    ref={inputRef}
                    autoFocus
                    role="combobox"
                    aria-expanded
                    aria-controls="command-list"
                    aria-activedescendant={rows[active] ? `cmd-${active}` : undefined}
                    aria-autocomplete="list"
                    className="h-12 w-full bg-transparent text-base text-ink placeholder:text-faint focus:outline-none"
                    placeholder="Search members, or type a command…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
                      else if (e.key === 'Enter') { e.preventDefault(); runRow(rows[active]) }
                    }}
                  />
                  <Kbd>Esc</Kbd>
                </div>
                <div ref={listRef} id="command-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2 scrollbar-thin">
                  {rows.length === 0 ? <p className="px-3 py-8 text-center text-sm text-muted">No members or commands match “{query}”.</p> : null}
                  {rows.map((row, i) => {
                    const group = row.kind === 'member' ? 'Members' : row.command.group
                    const showGroup = group !== lastGroup
                    lastGroup = group
                    return (
                      <div key={row.kind === 'member' ? row.member.id : row.command.id}>
                        {showGroup ? <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.08em] text-faint">{group}</p> : null}
                        <div
                          id={`cmd-${i}`}
                          role="option"
                          aria-selected={i === active}
                          data-index={i}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => runRow(row)}
                          className={cn('flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm', i === active ? 'bg-sunken text-ink' : 'text-ink')}
                        >
                          {row.kind === 'member' ? (
                            <>
                              <Avatar name={row.member.name} src={row.member.photoDataUrl} size="sm" />
                              <span className="min-w-0 flex-1 truncate">{row.member.name}</span>
                              <span className="tabular text-xs text-muted">{row.member.phone}</span>
                            </>
                          ) : (
                            <>
                              <row.command.icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                              <span className="min-w-0 flex-1 truncate">{row.command.label}</span>
                              {row.command.keys ? <span className="flex gap-1">{row.command.keys.split(' ').map((k) => <Kbd key={k}>{k}</Kbd>)}</span> : null}
                            </>
                          )}
                          {i === active ? <CornerDownLeft className="h-3.5 w-3.5 text-faint" aria-hidden /> : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}
