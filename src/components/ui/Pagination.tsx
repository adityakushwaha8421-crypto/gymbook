import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

export function Pagination({ page, pageCount, total, pageSize, onChange }: { page: number; pageCount: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-2.5 text-xs text-muted" aria-label="Pagination">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page" icon={<ChevronLeft className="h-4 w-4" aria-hidden />} />
        <span className="tabular px-1">
          {page} / {pageCount}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Next page" icon={<ChevronRight className="h-4 w-4" aria-hidden />} />
      </div>
    </nav>
  )
}

export function paginate<T>(items: T[], page: number, pageSize: number): { slice: T[]; pageCount: number; page: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safe = Math.min(Math.max(1, page), pageCount)
  return { slice: items.slice((safe - 1) * pageSize, safe * pageSize), pageCount, page: safe }
}
