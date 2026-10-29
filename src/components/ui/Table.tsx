import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table className={cn('w-full min-w-[640px] border-collapse text-sm', className)} {...rest} />
    </div>
  )
}

export function Th({ className, children, sort, onSort, active, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { sort?: 'asc' | 'desc'; active?: boolean; onSort?: () => void }) {
  const content = onSort ? (
    <button type="button" onClick={onSort} className="pressable -mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 hover:bg-sunken hover:text-ink" aria-sort={active ? (sort === 'asc' ? 'ascending' : 'descending') : undefined}>
      {children}
      {active ? sort === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />}
    </button>
  ) : (
    children
  )
  return (
    <th scope="col" className={cn('sticky top-0 z-[1] whitespace-nowrap border-b border-line/80 bg-surface/70 px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted backdrop-blur-md first:pl-5 last:pr-5', className)} {...rest}>
      {content}
    </th>
  )
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('whitespace-nowrap border-b border-line/70 px-4 py-3 align-middle first:pl-5 last:pr-5', className)} {...rest} />
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors duration-150 hover:bg-surface/60 [&:last-child>td]:border-b-0', className)} {...rest} />
}

/** Mobile replacement for a table row: label/value pairs in a card. */
export function RowCard({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={cn('border-b border-line/70 px-4 py-3.5 last:border-b-0', onClick && 'pressable cursor-pointer hover:bg-surface/60', className)} onClick={onClick}>
      {children}
    </div>
  )
}
