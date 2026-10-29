import { useCallback, useRef, useState } from 'react'
import type { ZodError } from 'zod'
import { fieldErrors } from '@/domain/validation'
import { errorMessage } from '@/data/errors'

export interface FormState<TInput extends Record<string, unknown>> {
  values: TInput
  errors: Record<string, string>
  formError: string | null
  dirty: boolean
  saving: boolean
  set: <K extends keyof TInput>(key: K, value: TInput[K]) => void
  setValues: (values: TInput) => void
  reset: (values?: TInput) => void
  setFormError: (msg: string | null) => void
  /** Validate with the schema, run onValid, surface any thrown error, keep values on failure. */
  submit: (e?: { preventDefault?: () => void }) => Promise<boolean>
  requestKey: string
}

/**
 * Small controlled-form helper. Keeps entered values after validation or
 * save failures, exposes dirty state for discard confirmation and prevents
 * double submission while saving.
 */
export interface FormSchema<TOutput> {
  safeParse(data: unknown): { success: true; data: TOutput } | { success: false; error: ZodError }
}

export function useForm<TInput extends Record<string, unknown>, TOutput>(
  initial: TInput,
  schema: FormSchema<TOutput>,
  onValid: (values: TOutput, ctx: { requestKey: string }) => Promise<void> | void,
): FormState<TInput> {
  const [values, setValuesState] = useState<TInput>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const requestKeyRef = useRef<string>(`req_${Math.random().toString(36).slice(2)}`)

  const set = useCallback(<K extends keyof TInput>(key: K, value: TInput[K]) => {
    setValuesState((v) => ({ ...v, [key]: value }))
    setDirty(true)
    setFormError(null)
    setErrors((e) => {
      if (!(key as string in e)) return e
      const next = { ...e }
      delete next[key as string]
      return next
    })
  }, [])

  const setValues = useCallback((v: TInput) => {
    setValuesState(v)
    setDirty(true)
  }, [])

  const reset = useCallback((v?: TInput) => {
    setValuesState(v ?? initial)
    setErrors({})
    setFormError(null)
    setDirty(false)
    requestKeyRef.current = `req_${Math.random().toString(36).slice(2)}`
  }, [initial])

  const submit = useCallback(
    async (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.()
      if (savingRef.current) return false
      const parsed = schema.safeParse(values)
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error))
        setFormError(null)
        return false
      }
      setErrors({})
      setFormError(null)
      savingRef.current = true
      setSaving(true)
      try {
        await onValid(parsed.data, { requestKey: requestKeyRef.current })
        setDirty(false)
        return true
      } catch (err) {
        setFormError(errorMessage(err))
        return false
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    },
    [values, schema, onValid],
  )

  return { values, errors, formError, dirty, saving, set, setValues, reset, setFormError, submit, requestKey: requestKeyRef.current }
}
