import { Link } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { useEffect } from 'react'
import { LinkButton } from '@/components/ui/Button'

export function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · GymBook'
  }, [])
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Link to="/" className="pressable mb-6 flex items-center gap-2 rounded-xl p-2" aria-label="GymBook home">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <Dumbbell className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-xl font-semibold">GymBook</span>
      </Link>
      <p className="text-sm font-medium uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-1 text-2xl font-semibold">This page doesn’t exist</h1>
      <p className="mt-2 max-w-sm text-muted">The link may be out of date, or the record it pointed to was never created in this browser.</p>
      <LinkButton to="/" className="mt-6">
        Go to the dashboard
      </LinkButton>
      <p className="mt-10 text-xs text-faint">© {new Date().getFullYear()} GymBook</p>
    </div>
  )
}
