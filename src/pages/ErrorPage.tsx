import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'

export function ErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : 'Unknown error'
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Link to="/" className="pressable mb-6 flex items-center gap-2 rounded-xl p-2" aria-label="GymBook home">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <Dumbbell className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-xl font-semibold">GymBook</span>
      </Link>
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">Your data is stored safely in this browser; this screen only means the page failed to draw.</p>
      <pre className="mt-4 max-w-full overflow-x-auto rounded-xl bg-sunken px-4 py-3 text-left text-xs text-muted">{message}</pre>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <LinkButton to="/" variant="secondary" reloadDocument>
          Go to dashboard
        </LinkButton>
      </div>
    </div>
  )
}
