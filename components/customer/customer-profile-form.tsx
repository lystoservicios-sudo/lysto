'use client'

import { useMemo, useState, type FormEvent } from 'react'

import { FormFeedback } from './states'
import { InfoNotice } from './info-notice'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import type { CustomerProfileViewModel } from '@/features/customer/view-models'

type SubmissionResult = { ok: boolean; message: string }
type SubmissionState = 'idle' | 'pending' | 'success' | 'error'
type ProfileErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone', string>>

function validateProfile(value: CustomerProfileViewModel): ProfileErrors {
  const errors: ProfileErrors = {}
  if (!value.firstName.trim()) errors.firstName = 'Ingresá tu nombre.'
  if (!value.lastName.trim()) errors.lastName = 'Ingresá tu apellido.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()))
    errors.email = 'Ingresá un email válido.'
  if (value.phone.replace(/\D/g, '').length < 8) errors.phone = 'Ingresá un teléfono válido.'
  return errors
}

export function CustomerProfileForm({
  initialValue,
  onSubmit,
  emailReadOnly = false
}: {
  initialValue: CustomerProfileViewModel
  onSubmit?: (value: CustomerProfileViewModel) => Promise<SubmissionResult>
  emailReadOnly?: boolean
}) {
  const [value, setValue] = useState(initialValue)
  const [touched, setTouched] = useState<Partial<Record<keyof CustomerProfileViewModel, boolean>>>(
    {}
  )
  const [submission, setSubmission] = useState<{ state: SubmissionState; message?: string }>({
    state: 'idle'
  })
  const errors = useMemo(() => validateProfile(value), [value])
  const isDirty = JSON.stringify(value) !== JSON.stringify(initialValue)
  const isValid = Object.keys(errors).length === 0
  const isPending = submission.state === 'pending'

  const changeField = <K extends keyof CustomerProfileViewModel>(
    field: K,
    nextValue: CustomerProfileViewModel[K]
  ) => {
    setValue((current) => ({ ...current, [field]: nextValue }))
    setTouched((current) => ({ ...current, [field]: true }))
    setSubmission({ state: 'idle' })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onSubmit || !isDirty || !isValid || isPending) return
    setSubmission({ state: 'pending', message: 'Guardando cambios' })
    try {
      const result = await onSubmit(value)
      setSubmission({ state: result.ok ? 'success' : 'error', message: result.message })
    } catch {
      setSubmission({
        state: 'error',
        message: 'No pudimos guardar los cambios. Intentá nuevamente.'
      })
    }
  }

  const field = (
    name: keyof ProfileErrors,
    label: string,
    type: 'text' | 'email' | 'tel' = 'text'
  ) => {
    const errorId = `${name}-error`
    const error = errors[name]
    const invalid = Boolean(touched[name] && error)
    return (
      <div className="space-y-2">
        <Label htmlFor={`profile-${name}`}>{label}</Label>
        <Input
          id={`profile-${name}`}
          type={type}
          readOnly={name === 'email' && emailReadOnly}
          disabled={isPending}
          value={value[name]}
          autoComplete={
            name === 'firstName' ? 'given-name' : name === 'lastName' ? 'family-name' : name
          }
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => changeField(name, event.target.value)}
        />
        {invalid ? (
          <p id={errorId} className="text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6"
      noValidate
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Contacto</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">Datos personales</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Esta información se usará para coordinar visitas y avisos importantes.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('firstName', 'Nombre')}
        {field('lastName', 'Apellido')}
        {field('email', 'Email', 'email')}
        {field('phone', 'Teléfono', 'tel')}
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">
          Preferencia de notificaciones
        </legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['email', 'Email'],
              ['whatsapp', 'WhatsApp'],
              ['both', 'Ambos canales']
            ] as const
          ).map(([option, label]) => (
            <label
              key={option}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50"
            >
              <input
                type="radio"
                name="notificationPreference"
                value={option}
                checked={value.notificationPreference === option}
                onChange={() => changeField('notificationPreference', option)}
                className="h-4 w-4 accent-blue-600"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm font-semibold text-slate-600">
        {isDirty ? 'Tenés cambios sin guardar' : 'No hay cambios pendientes'}
      </p>
      {!onSubmit ? (
        <InfoNotice
          title="Guardado pendiente"
          description="El guardado del perfil se conectará cuando esté disponible la persistencia."
        />
      ) : null}
      <FormFeedback state={submission.state} message={submission.message} />
      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button
          type="submit"
          disabled={!onSubmit || !isDirty || !isValid || isPending}
          aria-busy={isPending || undefined}
        >
          {isPending ? 'Guardando' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
