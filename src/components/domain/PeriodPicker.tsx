import { Input } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/misc'
import { periodPreset, type Period } from '@/domain/metrics'
import { isISODate } from '@/domain/dates'

export type PresetName = '7d' | '30d' | 'month' | '90d' | 'year' | 'custom'

export function PeriodPicker({ preset, period, today, onChange }: { preset: PresetName; period: Period; today: string; onChange: (preset: PresetName, period: Period) => void }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:items-center">
      <Tabs
        value={preset}
        onChange={(p) => {
          if (p === 'custom') onChange('custom', period)
          else onChange(p, periodPreset(p, today))
        }}
        items={[
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
          { value: 'month', label: 'This month' },
          { value: '90d', label: '90 days' },
          { value: 'year', label: 'This year' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      {preset === 'custom' ? (
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="From date" value={period.start} max={period.end} onChange={(e) => isISODate(e.target.value) && onChange('custom', { start: e.target.value, end: e.target.value > period.end ? e.target.value : period.end })} className="h-9 w-auto text-sm" />
          <span className="text-sm text-muted">to</span>
          <Input type="date" aria-label="To date" value={period.end} min={period.start} onChange={(e) => isISODate(e.target.value) && onChange('custom', { start: e.target.value < period.start ? e.target.value : period.start, end: e.target.value })} className="h-9 w-auto text-sm" />
        </div>
      ) : null}
    </div>
  )
}
