import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PageSkeleton } from './Skeleton'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </span>
  )
}

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return <PageSkeleton label={label} />
}
