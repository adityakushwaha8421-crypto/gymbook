import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-shimmer rounded-md bg-sunken', className)} />
}

/** Generic page placeholder: stat row + a list block. Announces loading to assistive tech. */
export function PageSkeleton({ stats = 4, rows = 6, label = 'Loading' }: { stats?: number; rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-5">
      {stats > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-6 w-24" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="glass-card rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="ml-auto h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
