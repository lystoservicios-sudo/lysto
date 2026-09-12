'use client'

import { useState } from 'react'
import { Header, Panel } from './admin-ui'

type Field = {
  key: string
  label: string
  value: string
  type?: string
  min?: number
  max?: number
  step?: number
  hint?: string
}
export function SettingsForm({
  fields,
  onValues = () => undefined
}: {
  storageKey?: string
  fields: Field[]
  onValues?: (values: Record<string, string>) => void
}) {
  const initial = Object.fromEntries(fields.map((field) => [field.key, field.value])),
    [values, setValues] = useState(initial)
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      {fields.map((field) => (
        <label key={field.key} className="adm-field">
          {field.label}
          <input
            type={field.type ?? 'text'}
            value={values[field.key]}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(event) => {
              const next = { ...values, [field.key]: event.target.value }
              setValues(next)
              onValues(next)
            }}
          />
          {field.hint ? <small>{field.hint}</small> : null}
        </label>
      ))}
    </form>
  )
}
function Placeholder({ title }: { title: string }) {
  return (
    <>
      <Header
        title={title}
        description="Esta ruta productiva usa configuración versionada y permisos administrativos."
      />
      <Panel title="Configuración">
        <p>Consultá la ruta autenticada para ver los valores vigentes.</p>
      </Panel>
    </>
  )
}
export function PricesPage() {
  return <Placeholder title="Precios" />
}
export function NotificationsPage() {
  return <Placeholder title="Notificaciones" />
}
export function ServicesPage() {
  return <Placeholder title="Servicios" />
}
export function ZonesPage() {
  return <Placeholder title="Zonas" />
}
export function DiagnosisPage() {
  return <Placeholder title="Diagnóstico" />
}
export function MarketplacePage() {
  return <Placeholder title="Marketplace" />
}
