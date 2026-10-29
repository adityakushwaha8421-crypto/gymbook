import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { springDefault, fadeReduced } from '@/lib/motion'
import { useIsDesktop } from '@/hooks/useMediaQuery'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  description?: string
}
interface ToastApi {
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const reduced = useReducedMotion()
  const isDesktop = useIsDesktop()

  const push = useCallback((tone: ToastTone, title: string, description?: string) => {
    const id = ++counter
    setItems((list) => [...list.slice(-3), { id, tone, title, description }])
    const ttl = tone === 'error' ? 8000 : 4000
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), ttl)
  }, [])

  const api = useMemo<ToastApi>(() => ({ success: (t, d) => push('success', t, d), error: (t, d) => push('error', t, d), info: (t, d) => push('info', t, d) }), [push])
  const dismiss = (id: number) => setItems((list) => list.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-[calc(56px+env(safe-area-inset-top)+8px)] z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:items-end" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout={!reduced}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: isDesktop ? 12 : -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: isDesktop ? 6 : -6, scale: 0.98 }}
              transition={reduced ? fadeReduced : springDefault}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 glass-pop rounded-2xl px-3.5 py-3"
            >
              <span className="mt-0.5 shrink-0">
                {t.tone === 'success' ? <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden /> : null}
                {t.tone === 'error' ? <AlertTriangle className="h-4 w-4 text-danger" aria-hidden /> : null}
                {t.tone === 'info' ? <Info className="h-4 w-4 text-info" aria-hidden /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-5">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-xs leading-4 text-muted">{t.description}</p> : null}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className={cn('pressable -m-1 rounded-md p-1 text-faint hover:bg-sunken hover:text-ink')} aria-label="Dismiss">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
