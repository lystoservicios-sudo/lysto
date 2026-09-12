'use client'
import { useState } from 'react'
import type { NotificationDeliveryPage, NotificationDelivery } from '@/lib/notifications/operations'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Button, Header, Panel } from './admin-ui'

const states = {
  queued: 'En cola',
  leased: 'En proceso',
  processed: 'Procesada',
  dead_letter: 'Requiere intervención',
  suppressed: 'Suprimida',
  manual: 'Gestión manual'
}
const channels = {
  in_app: 'Interna',
  email: 'Email',
  whatsapp_manual: 'WhatsApp manual',
  push: 'Push'
}
export function ConnectedNotificationDeliveries({
  initial
}: {
  initial: NotificationDeliveryPage
}) {
  const [page, setPage] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [reasons, setReasons] = useState<Record<string, string>>({})
  async function load(more = false) {
    setBusy(true)
    setError('')
    try {
      const result = await privateRequest<NotificationDeliveryPage>(
        '/api/admin/notifications' +
          (more && page.nextCursor ? `?cursor=${encodeURIComponent(page.nextCursor)}` : '')
      )
      setPage((current) => ({
        ...result,
        items: more
          ? [
              ...current.items,
              ...result.items.filter(
                (item) => !current.items.some((existing) => existing.id === item.id)
              )
            ]
          : result.items
      }))
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function retry(item: NotificationDelivery) {
    const reason = reasons[item.id]?.trim() ?? ''
    if (reason.length < 10) {
      setError('Ingresá un motivo de al menos 10 caracteres.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await privateRequest<{ delivery: NotificationDelivery }>(
        '/api/admin/notifications',
        'PATCH',
        { eventId: item.id, expectedVersion: item.version, reason }
      )
      setPage((current) => ({
        ...current,
        items: current.items.map((value) => (value.id === item.id ? result.delivery : value)),
        counts: {
          ...current.counts,
          deadLetter: Math.max(0, current.counts.deadLetter - 1),
          queued: current.counts.queued + 1
        }
      }))
      setReasons((current) => ({ ...current, [item.id]: '' }))
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Header
        title="Entrega de notificaciones"
        section="Operación"
        description="Cola persistente, reintentos y fallos que requieren intervención."
        action={
          <Button disabled={busy} onClick={() => void load()}>
            {busy ? 'Cargando…' : 'Actualizar'}
          </Button>
        }
      />
      <p>La aceptación del mensaje por el proveedor no confirma la entrega al buzón.</p>
      {error && <p role="alert">{error}</p>}
      <Panel title="Estado de la cola" description={`${page.total} eventos registrados`}>
        <dl className="adm-facts">
          {Object.entries({
            EnCola: page.counts.queued,
            EnProceso: page.counts.leased,
            Procesadas: page.counts.processed,
            Intervención: page.counts.deadLetter,
            Suprimidas: page.counts.suppressed,
            Manuales: page.counts.manual
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title="Eventos recientes">
        {!page.items.length && <p>No hay eventos de entrega.</p>}
        <ul>
          {page.items.map((item) => (
            <li className="border-b py-4" key={item.id}>
              <strong>{item.eventType}</strong> · {channels[item.channel]} ·{' '}
              <span>{states[item.state]}</span>
              <p>
                Intentos: {item.attemptCount} de {item.maxAttempts} · versión {item.version}
              </p>
              {item.lastError && <p>Código: {item.lastError}</p>}
              {item.providerAccepted && <p>Aceptado por el proveedor.</p>}
              {item.state === 'dead_letter' && (
                <div className="adm-form">
                  <label>
                    Motivo del reintento
                    <textarea
                      aria-label="Motivo del reintento"
                      minLength={10}
                      maxLength={1000}
                      disabled={busy}
                      value={reasons[item.id] ?? ''}
                      onChange={(event) =>
                        setReasons((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                    />
                  </label>
                  <Button disabled={busy} onClick={() => void retry(item)}>
                    Reintentar entrega
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {page.nextCursor && (
          <Button disabled={busy} onClick={() => void load(true)}>
            Cargar más
          </Button>
        )}
      </Panel>
    </>
  )
}
