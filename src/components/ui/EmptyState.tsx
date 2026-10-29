import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-4 py-16', className)}>
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center glass-inset rounded-2xl border border-line/70 text-muted">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ title = 'Could not load this', message, action }: { title?: string; message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-5 text-center">
      <h3 className="font-semibold text-danger">{title}</h3>
      <p className="mt-1 text-sm text-danger/90">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
