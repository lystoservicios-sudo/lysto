'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { EducationBenefitPanel } from './education-benefit-panel'

type Plan = {
  id: string
  equipmentId: string
  equipmentName: string
  recommendation: string
  dueAt: string | null
  status: string
  version: number
  sourceJobId: string | null
  history: {
    id: string
    performedAt: string
    diagnosis: string | null
    workDone: string | null
    professionalId: string | null
  }[]
}
export function ConnectedCustomerMaintenance() {
  const [plans, setPlans] = useState<Plan[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      setPlans(
        (await privateRequest<{ maintenance: Plan[] }>('/api/maintenance/schedule')).maintenance
      )
    } catch (e) {
      setError(requestError(e))
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  async function act(event: React.FormEvent<HTMLFormElement>, plan: Plan) {
    event.preventDefault()
    const f = new FormData(event.currentTarget),
      action = String(f.get('action'))
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await privateRequest<{
        plan: { status: string; reservationCreated: false; paymentCreated: false }
      }>('/api/maintenance/schedule', 'POST', {
        planId: plan.id,
        action,
        expectedVersion: plan.version,
        dueDate: action === 'defer' ? String(f.get('dueDate')) : undefined,
        addressId: action === 'request_service' ? String(f.get('addressId')) : undefined
      })
      await load()
      setMessage(
        result.plan.status === 'requested'
          ? 'Solicitud iniciada como borrador. Confirmá sus datos antes de enviarla; no se reservó visita ni se generó cobro.'
          : 'Nueva fecha recomendada guardada.'
      )
    } catch (e) {
      setError(requestError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-5">
      <EducationBenefitPanel />
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {!busy && !plans.length ? <p>No hay recomendaciones reales para tus equipos.</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p) => (
          <article className="rounded-3xl border border-slate-200 bg-white p-5" key={p.id}>
            <h2 className="text-xl font-black">{p.equipmentName}</h2>
            <p className="mt-2">
              {p.recommendation} · {p.status}
            </p>
            {p.dueAt ? <p>Fecha recomendada: {p.dueAt}</p> : null}
            {p.status === 'suppressed_by_case' ? (
              <p className="mt-3 text-amber-800">
                Hay un caso de calidad o garantía abierto. Primero resolvamos esa falla.
              </p>
            ) : (
              <form onSubmit={(e) => void act(e, p)} className="mt-4 space-y-3">
                <label className="block">
                  Acción
                  <select name="action" className="ml-2 rounded border p-2">
                    <option value="defer">Cambiar fecha recomendada</option>
                    <option value="request_service">Iniciar solicitud</option>
                  </select>
                </label>
                <label className="block">
                  Nueva fecha
                  <input name="dueDate" type="date" className="ml-2 rounded border p-2" />
                </label>
                <label className="block">
                  Dirección actual (ID)
                  <input name="addressId" className="ml-2 rounded border p-2" />
                </label>
                <Button disabled={busy} type="submit">
                  Continuar
                </Button>
              </form>
            )}
            <details className="mt-4">
              <summary>Historial técnico ({p.history.length})</summary>
              {p.history.map((h) => (
                <p key={h.id} className="mt-2 text-sm">
                  {h.performedAt}: {h.diagnosis} · {h.workDone}
                </p>
              ))}
            </details>
          </article>
        ))}
      </div>
    </div>
  )
}
