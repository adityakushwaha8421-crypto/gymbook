import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const controlClasses =
  'w-full rounded-xl border border-line bg-surface/80 px-3.5 text-base text-ink shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 disabled:bg-sunken disabled:text-muted disabled:shadow-none aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
}

/** Label + control + hint/error with correct aria associations. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(controlClasses, 'h-control', className)} {...rest} />
})

const chevron =
  "bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23929290' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")]"

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(controlClasses, 'h-control appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9', chevron, className)} {...rest}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(controlClasses, 'min-h-[88px] py-2', className)} {...rest} />
})

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cn('inline-flex min-h-9 cursor-pointer items-center gap-2.5 text-base', className)}>
      <input id={id} type="checkbox" className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent" {...rest} />
      <span>{label}</span>
    </label>
  )
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger">
      {message}
    </div>
  )
}

export function MoneyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted" aria-hidden>
        ₹
      </span>
      <Input inputMode="decimal" autoComplete="off" {...props} className={cn('pl-7 tabular', props.className)} />
    </div>
  )
}
