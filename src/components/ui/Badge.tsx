import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Tone = 'neutral' | 'accent' | 'danger' | 'warn' | 'info' | 'muted'

const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink ring-line',
  muted: 'bg-sunken text-muted ring-line',
  accent: 'bg-accent-soft text-accent-ink ring-accent/20',
  danger: 'bg-danger-soft text-danger ring-danger/20',
  warn: 'bg-warn-soft text-warn ring-warn/25',
  info: 'bg-info-soft text-info ring-info/20',
}
const dots: Record<Tone, string> = {
  neutral: 'bg-faint',
  muted: 'bg-faint',
  accent: 'bg-accent',
  danger: 'bg-danger',
  warn: 'bg-warn',
  info: 'bg-info',
}

export function Badge({ tone = 'neutral', children, className, title, dot }: { tone?: Tone; children: ReactNode; className?: string; title?: string; dot?: boolean }) {
  return (
    <span title={title} className={cn('inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden /> : null}
      {children}
    </span>
  )
}

export function SampleBadge() {
  return (
    <Badge tone="info" title="This record is part of the labelled sample data">
      Sample
    </Badge>
  )
}
