'use client'
import { useCallback, useEffect, useState } from 'react'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Badge, Button, Field, Header, Notice, Panel } from './admin-ui'

type Case = {
  id: string
  jobId: string | null
  category: string
  status: string
  severity: string
  description: string
  dueAt: string | null
  assignedTo: string | null
  publicResolution: string | null
  version: number
  createdAt: string
  warrantyClaim: {
    id: string
    status: string
    version: number
    coverageEligible: boolean
    coverageUntil: string | null
    revisitJobId: string | null
  } | null
  events: {
    id: string
    type: string
    message: string | null
    internalNote: string | null
    createdAt: string
  }[]
}
export function ConnectedSupportCases({ warranty = false }: { warranty?: boolean }) {
  const [cases, setCases] = useState<Case[]>([]),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const r = await privateRequest<{ cases: Case[] }>('/api/support/cases?limit=100')
      const rows = warranty ? r.cases.filter((c) => c.category === 'warranty') : r.cases
      setCases(rows)
      setSelected((s) => (rows.some((c) => c.id === s) ? s : (rows[0]?.id ?? '')))
    } catch (e) {
      setError(requestError(e))
    } finally {
      setBusy(false)
    }
  }, [warranty])
  useEffect(() => {
    void load()
  }, [load])
  async function act(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const current = cases.find((c) => c.id === selected)
    if (!current) return
    const f = new FormData(event.currentTarget),
      action = String(f.get('action')),
      reason = String(f.get('reason') ?? '')
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (action === 'approve_warranty' || action === 'reject_warranty') {
        if (!current.warrantyClaim) throw new Error('El caso no tiene garantía vinculada.')
        await privateRequest(`/api/warranty/claim/${current.warrantyClaim.id}`, 'PATCH', {
          decision: action === 'approve_warranty' ? 'approve' : 'reject',
          expectedVersion: current.warrantyClaim.version,
          reason
        })
      } else
        await privateRequest(`/api/support/cases/${current.id}`, 'PATCH', {
          action,
          expectedVersion: current.version,
          publicMessage: reason || undefined,
          internalNote: String(f.get('internalNote') ?? '') || undefined,
          evidenceIds: [],
          resolutionReason: ['resolve', 'reject'].includes(action) ? reason : undefined,
          communicationFailed: false
        })
      await load()
      setMessage('Seguimiento registrado y auditado.')
    } catch (e) {
      setError(requestError(e))
    } finally {
      setBusy(false)
    }
  }
  const current = cases.find((c) => c.id === selected)
  return (
    <>
      <Header
        title={warranty ? 'Garantías' : 'Reclamos'}
        description="Cola real con responsable, vencimiento y cronología."
        section="Confianza y calidad"
        action={
          <Button disabled={busy} onClick={() => void load()}>
            Actualizar
          </Button>
        }
      />
      {error ? <p role="alert">{error}</p> : null}
      {message ? <Notice success>{message}</Notice> : null}
      <div className="adm-two-col">
        <Panel title="Casos">
          <div className="adm-stack">
            {cases.map((c) => (
              <Button key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>
                <span>
                  {c.category} · {c.severity} · {c.status}
                </span>
              </Button>
            ))}
            {!busy && !cases.length ? <Notice>No hay casos en esta cola.</Notice> : null}
          </div>
        </Panel>
        {current ? (
          <Panel title={`Caso ${current.id.slice(0, 8)}`}>
            <div className="adm-stack">
              <Badge value={current.status} />
              <p>{current.description}</p>
              <p>
                Vence:{' '}
                {current.dueAt ? new Date(current.dueAt).toLocaleString('es-AR') : 'sin plazo'}
              </p>
              <p>
                Responsable: {current.assignedTo ? 'asignado' : 'se asignará al iniciar revisión'}
              </p>
              {current.warrantyClaim ? (
                <p>
                  Cobertura calculada:{' '}
                  {current.warrantyClaim.coverageEligible ? 'elegible' : 'no elegible'}
                  {current.warrantyClaim.coverageUntil
                    ? ` hasta ${current.warrantyClaim.coverageUntil}`
                    : ''}
                </p>
              ) : null}
              <form onSubmit={act} className="adm-stack">
                <Field label="Acción">
                  <select
                    name="action"
                    required
                    defaultValue={current.status === 'open' ? 'start_review' : 'resolve'}
                  >
                    <option value="start_review">Iniciar revisión</option>
                    <option value="wait_customer">Esperar cliente</option>
                    <option value="wait_professional">Esperar profesional</option>
                    <option value="resolve">Resolver</option>
                    <option value="reject">Rechazar</option>
                    <option value="reopen">Reabrir</option>
                    {current.warrantyClaim?.coverageEligible ? (
                      <option value="approve_warranty">
                        Aprobar garantía y crear revisita sin cargo
                      </option>
                    ) : null}
                    {current.warrantyClaim ? (
                      <option value="reject_warranty">Rechazar cobertura</option>
                    ) : null}
                  </select>
                </Field>
                <Field label="Respuesta o motivo">
                  <textarea name="reason" required minLength={10} />
                </Field>
                <Field label="Nota interna">
                  <textarea name="internalNote" minLength={2} />
                </Field>
                <Button type="submit" variant="primary" disabled={busy}>
                  Guardar seguimiento
                </Button>
              </form>
              <div>
                <strong>Cronología</strong>
                {current.events.map((e) => (
                  <p key={e.id}>
                    {new Date(e.createdAt).toLocaleString('es-AR')} · {e.type}
                    {e.message ? ` · ${e.message}` : ''}
                    {e.internalNote ? ` · Nota interna: ${e.internalNote}` : ''}
                  </p>
                ))}
              </div>
            </div>
          </Panel>
        ) : null}
      </div>
    </>
  )
}
