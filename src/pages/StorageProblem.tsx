import { Dumbbell, RefreshCw } from 'lucide-react'
import type { StorageError } from '@/data/errors'
import { Button } from '@/components/ui/Button'

export function StorageProblem({ error, retry }: { error: StorageError; retry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg">
        <Dumbbell className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">GymBook can’t open its storage</h1>
      <p className="mt-2 max-w-md text-muted">{error.message}</p>
      <ul className="mt-4 max-w-md list-disc space-y-1 text-left text-sm text-muted">
        <li>Private or incognito windows often block IndexedDB. Try a normal window.</li>
        <li>If another GymBook tab is open with an older version, close it and retry.</li>
        <li>If storage is full, free up space in the browser’s site settings.</li>
      </ul>
      <Button className="mt-6" onClick={retry} icon={<RefreshCw className="h-4 w-4" aria-hidden />}>
        Try again
      </Button>
    </div>
  )
}
