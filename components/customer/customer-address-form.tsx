'use client'

import { useMemo, useState, type FormEvent } from 'react'

import { FormFeedback } from './states'
import { InfoNotice } from './info-notice'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import type { CustomerAddressViewModel } from '@/features/customer/view-models'

type SubmissionResult = { ok: boolean; message: string }
type SubmissionState = 'idle' | 'pending' | 'success' | 'error'
type AddressField = 'label' | 'street' | 'number' | 'floor' | 'apartment' | 'city' | 'province'
type AddressErrors = Partial<Record<'label' | 'street' | 'number' | 'city' | 'province', string>>

function validateAddress(value: CustomerAddressViewModel): AddressErrors {
  const errors: AddressErrors = {}
  if (!value.label.trim()) errors.label = 'Ingresá un nombre para identificarla.'
  if (!value.street.trim()) errors.street = 'Ingresá la calle.'
  if (!value.number.trim()) errors.number = 'Ingresá la altura.'
  if (!value.city.trim()) errors.city = 'Ingresá la ciudad.'
  if (!value.province.trim()) errors.province = 'Ingresá la provincia.'
  return errors
}

const accessOptions = [
  ['hasElevator', 'Hay ascensor'],
  ['hasParking', 'Hay estacionamiento'],
  ['stairsRequired', 'Se usan escaleras'],
  ['outdoorUnitAtHeight', 'Unidad exterior en altura'],
  ['outdoorUnitOnBalcony', 'Unidad exterior en balcón'],
  ['difficultAccess', 'Acceso complejo']
] as const

export function CustomerAddressForm({ initialValue, onSubmit }: {
  initialValue: CustomerAddressViewModel
  onSubmit?: (value: CustomerAddressViewModel) => Promise<SubmissionResult>
}) {
  const [value, setValue] = useState(initialValue)
  const [touched, setTouched] = useState<Partial<Record<AddressField, boolean>>>({})
  const [submission, setSubmission] = useState<{ state: SubmissionState; message?: string }>({ state: 'idle' })
  const errors = useMemo(() => validateAddress(value), [value])
  const isDirty = JSON.stringify(value) !== JSON.stringify(initialValue)
  const isValid = Object.keys(errors).length === 0
  const isPending = submission.state === 'pending'

  const changeField = (field: AddressField, nextValue: string) => {
    setValue((current) => ({ ...current, [field]: nextValue }))
    setTouched((current) => ({ ...current, [field]: true }))
    setSubmission({ state: 'idle' })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onSubmit || !isDirty || !isValid || isPending) return
    setSubmission({ state: 'pending', message: 'Guardando dirección' })
    try {
      const result = await onSubmit(value)
      setSubmission({ state: result.ok ? 'success' : 'error', message: result.message })
    } catch {
      setSubmission({ state: 'error', message: 'No pudimos guardar la dirección. Intentá nuevamente.' })
    }
  }

  const field = (name: AddressField, label: string, autoComplete?: string) => {
    const error = errors[name as keyof AddressErrors]
    const invalid = Boolean(touched[name] && error)
    const errorId = `address-${name}-error`
    return (
      <div className="space-y-2">
        <Label htmlFor={`address-${name}`}>{label}</Label>
        <Input id={`address-${name}`} value={value[name]} autoComplete={autoComplete} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} onChange={(event) => changeField(name, event.target.value)} />
        {invalid ? <p id={errorId} className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6" noValidate>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Acceso para la visita</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">Editar dirección</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Los detalles de acceso ayudan a preparar herramientas, movilidad y tiempos.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('label', 'Nombre de la dirección')}
        {field('street', 'Calle', 'address-line1')}
        {field('number', 'Número')}
        {field('floor', 'Piso', 'address-line2')}
        {field('apartment', 'Departamento')}
        {field('city', 'Ciudad', 'address-level2')}
        {field('province', 'Provincia', 'address-level1')}
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">Condiciones de acceso</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {accessOptions.map(([name, label]) => (
            <label key={name} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50">
              <input
                type="checkbox"
                checked={Boolean(value.access[name])}
                onChange={(event) => {
                  setValue((current) => ({ ...current, access: { ...current.access, [name]: event.target.checked } }))
                  setSubmission({ state: 'idle' })
                }}
                className="h-4 w-4 rounded accent-blue-600"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm font-semibold text-slate-600">{isDirty ? 'Tenés cambios sin guardar' : 'No hay cambios pendientes'}</p>
      {!onSubmit ? <InfoNotice title="Guardado pendiente" description="El guardado de direcciones se conectará cuando esté disponible la persistencia." /> : null}
      <FormFeedback state={submission.state} message={submission.message} />
      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button type="submit" disabled={!onSubmit || !isDirty || !isValid || isPending} aria-busy={isPending || undefined}>
          {isPending ? 'Guardando' : 'Guardar dirección'}
        </Button>
      </div>
    </form>
  )
}
