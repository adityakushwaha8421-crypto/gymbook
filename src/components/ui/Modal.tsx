import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useAnimationControls, useDragControls, useReducedMotion, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import type React from 'react'
import { cn } from '@/lib/cn'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { springSheet, fadeReduced, springDefault } from '@/lib/motion'

export interface ModalProps {
  open: boolean
  /** Called when the person asks to close (X, Escape, backdrop, drag). The parent decides whether to confirm. */
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Keep the panel mounted while open so inputs are never replaced mid-edit. */
  className?: string
}

const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }

/**
 * Accessible dialog (Radix: focus trap, Escape, focus restore). On narrow
 * screens it renders as a bottom sheet that can be dragged down to dismiss,
 * with rubber-banding at the top; the close button is always visible.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }: ModalProps) {
  const isDesktop = useIsDesktop()
  const reduced = useReducedMotion()
  const controls = useAnimationControls()
  const dragControls = useDragControls()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) controls.start({ y: 0 })
  }, [open, controls])

  // Restore focus to whatever opened the dialog once it closes, even when the
  // parent unmounts the dialog immediately (so Radix cannot do it for us).
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      return
    }
    const opener = openerRef.current
    if (!opener) return
    const id = setTimeout(() => {
      if (document.activeElement === document.body && opener.isConnected) opener.focus({ preventScroll: true })
    }, 50)
    return () => clearTimeout(id)
  }, [open])
  useEffect(() => () => {
    const opener = openerRef.current
    if (!opener) return
    setTimeout(() => {
      if (document.activeElement === document.body && opener.isConnected) opener.focus({ preventScroll: true })
    }, 50)
  }, [])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const shouldClose = info.offset.y > 120 || info.velocity.y > 600
    if (shouldClose) onClose()
    else controls.start({ y: 0, transition: springSheet })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeReduced}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount onCloseAutoFocus={(e) => {
              e.preventDefault()
              const opener = openerRef.current
              if (opener?.isConnected) opener.focus({ preventScroll: true })
            }} onOpenAutoFocus={(e) => {
              // Focus the first control rather than the close button.
              const el = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('input, select, textarea, button[data-primary]')
              if (el) {
                e.preventDefault()
                el.focus()
              }
            }}>
              <motion.div
                role="dialog"
                className={cn(
                  'glass-pop fixed z-50 flex flex-col focus:outline-none',
                  isDesktop
                    ? cn('left-1/2 top-1/2 w-[calc(100%-2rem)] max-h-[calc(100dvh-4rem)] rounded-2xl', widths[size])
                    : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]',
                  className,
                )}
                style={isDesktop ? { x: '-50%', y: '-50%' } : undefined}
                initial={reduced ? { opacity: 0 } : isDesktop ? { opacity: 0, scale: 0.98, x: '-50%', y: '-48%' } : { y: '100%' }}
                animate={reduced ? { opacity: 1 } : isDesktop ? { opacity: 1, scale: 1, x: '-50%', y: '-50%' } : { y: 0 }}
                exit={reduced ? { opacity: 0 } : isDesktop ? { opacity: 0, scale: 0.98, x: '-50%', y: '-49%' } : { y: '100%' }}
                transition={reduced ? fadeReduced : isDesktop ? springDefault : springSheet}
                drag={!isDesktop && !reduced ? 'y' : false}
                dragControls={dragControls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.08, bottom: 1 }}
                dragSnapToOrigin
                dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
                onDragEnd={onDragEnd}
                dragListener={false}
              >
                <SheetHeader title={title} description={description} isDesktop={isDesktop} onHandlePointerDown={(e) => { if (!isDesktop && !reduced) dragControls.start(e) }} />
                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
                  {children}
                </div>
                {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line/70 bg-sunken/40 px-4 py-3 sm:rounded-b-2xl sm:px-5">{footer}</div> : null}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}

function SheetHeader({ title, description, isDesktop, onHandlePointerDown }: { title: ReactNode; description?: ReactNode; isDesktop: boolean; onHandlePointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div className={cn('flex items-start gap-3 px-4 pt-3 pb-3 sm:px-5 sm:pt-4', !isDesktop && 'touch-none cursor-grab active:cursor-grabbing')} onPointerDown={onHandlePointerDown}>
      <div className="min-w-0 flex-1">
        {!isDesktop ? <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-line-strong" aria-hidden /> : null}
        <Dialog.Title className="text-lg font-semibold leading-6 tracking-[-0.01em]">{title}</Dialog.Title>
        {description ? <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Dialog</Dialog.Description>}
      </div>
      <Dialog.Close asChild>
        <button type="button" className="pressable -mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-sunken hover:text-ink" aria-label="Close">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </Dialog.Close>
    </div>
  )
}
