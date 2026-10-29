import { Modal } from '@/components/ui/Modal'
import { Kbd } from '@/components/ui/Button'

const groups: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'General',
    items: [
      { keys: ['⌘', 'K'], label: 'Search members and commands' },
      { keys: ['/'], label: 'Search' },
      { keys: ['N'], label: 'Add member' },
      { keys: ['['], label: 'Collapse or expand the sidebar' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['Esc'], label: 'Close dialogs' },
    ],
  },
  {
    title: 'Go to',
    items: [
      { keys: ['G', 'D'], label: 'Dashboard' },
      { keys: ['G', 'M'], label: 'Members' },
      { keys: ['G', 'P'], label: 'Plans' },
      { keys: ['G', 'A'], label: 'Attendance' },
      { keys: ['G', 'Y'], label: 'Payments' },
      { keys: ['G', 'T'], label: 'Trainers' },
      { keys: ['G', 'E'], label: 'Expenses' },
      { keys: ['G', 'F'], label: 'Follow-ups' },
      { keys: ['G', 'R'], label: 'Reports' },
      { keys: ['G', 'C'], label: 'PT sessions' },
      { keys: ['G', 'W'], label: 'Workout plans' },
      { keys: ['G', 'Q'], label: 'Equipment' },
      { keys: ['G', 'L'], label: 'Activity' },
      { keys: ['G', 'S'], label: 'Settings' },
    ],
  },
]

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" description="Shortcuts work anywhere except inside text fields." size="lg">
      <div className="grid gap-6 pb-2 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-faint">{g.title}</p>
            <ul className="divide-y divide-line">
              {g.items.map((it) => (
                <li key={it.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{it.label}</span>
                  <span className="flex gap-1">
                    {it.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}
