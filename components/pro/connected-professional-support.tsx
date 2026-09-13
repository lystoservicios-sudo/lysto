'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { ProPage, ProPanel } from './pro-ui'

type SupportCase = {
  id: string
  category: string
  status: string
  severity: string
  description: string
  dueAt: string | null
  version: number
}
export function ConnectedProfessionalSupport() {
  const [cases, setCases] = useState<SupportCase[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setBusy(true)
    try {
      setCases(
        (await privateRequest<{ cases: SupportCase[] }>('/api/support/cases?limit=30')).cases
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
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget,
      f = new FormData(form)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await privateRequest('/api/support/cases', 'POST', {
        jobId: String(f.get('jobId') || '') || undefined,
        category: f.get('category'),
        description: f.get('description'),
        hasSafetyRisk: f.get('category') === 'safety',
        paymentBlocked: f.get('category') === 'payment',
        customerWaiting: false,
        evidenceIds: [],
        idempotencyKey: crypto.randomUUID()
      })
      form.reset()
      await load()
      setMessage('Consulta creada. Ya figura en la cola de soporte.')
    } catch (e) {
      setError(requestError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <ProPage title="Soporte" description="Creá y seguí consultas reales de tu operación.">
      <div className="pro-two-col">
        <ProPanel title="Nueva consulta">
          <form onSubmit={submit} className="pro-stack">
            <label className="pro-field">
              Trabajo (opcional)
              <Input name="jobId" placeholder="UUID del trabajo" />
            </label>
            <label className="pro-field">
              Tema
              <select name="category" className="w-full rounded-xl border border-slate-300 p-3">
                <option value="delay">Agenda o demora</option>
                <option value="payment">Pago</option>
                <option value="quality">Calidad</option>
                <option value="safety">Seguridad</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label className="pro-field">
              ¿Qué pasó?
              <Textarea name="description" required minLength={10} maxLength={3000} />
            </label>
            <Button type="submit" disabled={busy}>
              Crear consulta
            </Button>
            {error ? <p role="alert">{error}</p> : null}
            {message ? <p role="status">{message}</p> : null}
          </form>
        </ProPanel>
        <ProPanel title="Mis consultas">
          {cases.map((c) => (
            <article key={c.id} className="border-b border-slate-100 py-3">
              <strong>
                {c.category} · {c.status}
              </strong>
              <p className="pro-muted">{c.description}</p>
              <small>
                Prioridad {c.severity}
                {c.dueAt ? ` · vence ${new Date(c.dueAt).toLocaleString('es-AR')}` : ''}
              </small>
            </article>
          ))}
          {!busy && !cases.length ? (
            <p className="pro-muted">No tenés consultas abiertas.</p>
          ) : null}
        </ProPanel>
      </div>
    </ProPage>
  )
}
