import { DEFAULT_SETTINGS } from '@/data/services/settings'
import { useState } from 'react'
import { Database, Sparkles } from 'lucide-react'
import { BRAND } from '@/brand'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, FormError } from '@/components/ui/Field'
import { chooseStartMode } from '@/data/bootstrap'
import { updateSettings } from '@/data/services/settings'
import { useApp } from '@/app/AppContext'
import { errorMessage } from '@/data/errors'
import { DEFAULT_TIMEZONE } from '@/domain/dates'
import { cn } from '@/lib/cn'

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Colombo', 'Europe/London', 'America/New_York', 'UTC']

export function Onboarding() {
  const { settings, refreshSettings } = useApp()
  const [gymName, setGymName] = useState(settings.gymName)
  const [timezone, setTimezone] = useState(settings.timezone || DEFAULT_TIMEZONE)
  const [mode, setMode] = useState<'sample' | 'empty'>('sample')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await updateSettings({ gymName: gymName.trim() || DEFAULT_SETTINGS.gymName, timezone })
      await chooseStartMode(mode, timezone)
      await refreshSettings()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-start gap-4">
          <img src={BRAND.logoDataUrl} alt="" className="h-14 w-14 rounded-2xl shadow-card" />
          <div>
            <h1 className="text-3xl font-semibold">Welcome to {BRAND.shortName}</h1>
            <p className="mt-1 text-base text-muted">Set up your gym in under a minute. Everything stays in this browser.</p>
          </div>
        </div>
        <div className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <Field label="Gym name" hint="Shown in the header and on invoices. You can change it later.">
              {({ id }) => <Input id={id} value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="e.g. Iron Temple Fitness" autoFocus />}
            </Field>
            <Field label="Timezone" hint="Dates such as “today” and membership expiry are evaluated in this timezone.">
              {({ id }) => (
                <Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {[...new Set([timezone, ...TIMEZONES])].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Start with</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <ModeCard active={mode === 'sample'} onClick={() => setMode('sample')} icon={<Sparkles className="h-5 w-5" aria-hidden />} title="Labelled sample data" description="A dozen fictional members, plans, payments and visits so you can explore. Every record is marked “Sample” and can be removed later." />
                <ModeCard active={mode === 'empty'} onClick={() => setMode('empty')} icon={<Database className="h-5 w-5" aria-hidden />} title="Start empty" description="No records. Add your own plans and members from scratch." />
              </div>
            </fieldset>
            <FormError message={error} />
            <Button size="lg" onClick={start} loading={busy} data-primary>
              {mode === 'sample' ? 'Load sample data and open GymBook' : 'Open GymBook'}
            </Button>
            <p className="text-xs leading-5 text-muted">
              GymBook keeps everything in this browser’s local storage (IndexedDB). Nothing is sent to a server, and data does <strong>not</strong> sync between devices or browsers. Use Settings → Backup to export a file you can restore elsewhere.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModeCard({ active, onClick, icon, title, description }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; description: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('pressable flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors', active ? 'border-accent bg-accent-soft/50 ring-[3px] ring-accent/20' : 'border-line hover:border-line-strong hover:bg-sunken/60')}
    >
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', active ? 'bg-accent text-accent-fg' : 'bg-sunken text-muted')}>{icon}</span>
      <span className="font-medium">{title}</span>
      <span className="text-xs leading-5 text-muted">{description}</span>
    </button>
  )
}
