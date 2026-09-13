'use client'
import { useEffect, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { QuoteInput, ServiceQuote } from '@/lib/pricing/service-quote'
import { QuoteBreakdown } from './quote-breakdown'
type SavedQuote = {
  id: string
  customer_id: string
  input: QuoteInput
  address: { street: string; number: string; city: string; province: string }
  quote: ServiceQuote
  status: string
  request_id: string | null
  expires_at: string
  version: number
  revision: number
  previous_quote_id: string | null
}
export function SavedQuotes({
  internal = false,
  canReview = true,
  revision = 0,
  onRecalculate
}: {
  internal?: boolean
  canReview?: boolean
  revision?: number
  onRecalculate?: (quote: SavedQuote) => void
}) {
  const [rows, setRows] = useState<SavedQuote[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [reason, setReason] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/pricing/quotes')
      .then(async (res) => {
        const data = await res.json()
        if (!active) return
        if (res.ok) {
          setRows(data.quotes)
          setNextCursor(data.nextCursor ?? null)
        } else setMessage(data.error)
      })
      .catch(() => {
        if (active) setMessage('No se pudieron consultar los presupuestos.')
      })
    return () => {
      active = false
    }
  }, [revision, refresh])
  async function act(row: SavedQuote) {
    if (busy) return
    setBusy(row.id)
    try {
      const response = await fetch(
        internal ? '/api/pricing/quotes' : '/api/customer/request/submit',
        {
          method: internal ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            internal
              ? { quoteId: row.id, expectedVersion: row.version, reason }
              : { quoteId: row.id, expectedVersion: row.version }
          ),
          signal: AbortSignal.timeout(15000)
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRefresh((value) => value + 1)
      setMessage(
        internal
          ? 'Alcance verificado. El cliente ya puede aceptar este presupuesto.'
          : 'Solicitud registrada y pendiente de asignación. No se realizó ningún cobro.'
      )
    } catch (error) {
      try {
        const recovery = await fetch(`/api/pricing/quotes?quoteId=${row.id}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(15000)
        })
        if (!recovery.ok)
          throw new Error('No se pudo verificar el estado. Volvé a consultar antes de reintentar.')
        const data = await recovery.json()
        const persisted: SavedQuote | undefined = data.quotes[0]
        if (persisted)
          setRows((current) => current.map((item) => (item.id === row.id ? persisted : item)))
        setMessage(
          !internal && persisted?.status === 'accepted'
            ? 'Solicitud registrada. Recuperamos la confirmación del servidor; no se realizó ningún cobro.'
            : error instanceof Error
              ? error.message
              : 'La operación no se confirmó. Podés reintentar con el estado actualizado.'
        )
      } catch {
        setMessage('No se pudo verificar el estado. Volvé a consultar antes de reintentar.')
      }
    } finally {
      setBusy(null)
    }
  }
  async function more() {
    if (!nextCursor || busy) return
    setBusy('page')
    try {
      const response = await fetch(`/api/pricing/quotes?cursor=${encodeURIComponent(nextCursor)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRows((previous) => [
        ...previous,
        ...data.quotes.filter((row: SavedQuote) => !previous.some((item) => item.id === row.id))
      ])
      setNextCursor(data.nextCursor)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar la página.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-black">Presupuestos guardados</h2>
      {message ? (
        <p role="status" className="text-sm text-blue-800">
          {message}
        </p>
      ) : null}
      {!rows.length ? (
        <Card className="p-5 text-sm text-slate-600">
          No hay presupuestos disponibles para esta cuenta.
        </Card>
      ) : null}
      {internal && canReview ? (
        <label className="block text-sm font-semibold">
          Verificación de alcance, costos y exclusiones
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Documentá qué importes y condiciones verificaste"
          />
        </label>
      ) : null}
      {rows.map((row) => (
        <details
          key={row.id}
          data-quote-id={row.id}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <summary className="cursor-pointer font-semibold">
            {row.address.street} {row.address.number} · {row.quote.scope} · ${' '}
            {row.quote.total.toLocaleString('es-AR')} · Revisión {row.revision} ·{' '}
            {row.status === 'superseded'
              ? 'Reemplazado'
              : row.status === 'accepted'
                ? 'Aceptado'
                : row.status === 'ready'
                  ? 'Listo para aceptar'
                  : 'En revisión'}
          </summary>
          <div className="mt-4 space-y-4">
            <QuoteBreakdown quote={row.quote} internal={internal} status={row.status} />
            <p className="text-xs text-slate-500">
              Vence: {new Date(row.expires_at).toLocaleString('es-AR')}
            </p>
            {row.previous_quote_id ? (
              <p className="text-xs text-slate-500">
                Reemplaza al presupuesto {row.previous_quote_id}.
              </p>
            ) : null}
            {row.status === 'superseded' ? (
              <p className="text-sm text-slate-600">
                Consultá la revisión más reciente para continuar.
              </p>
            ) : row.status !== 'accepted' ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={
                    Boolean(busy) ||
                    (internal && !canReview) ||
                    Date.parse(row.expires_at) <= Date.now() ||
                    (internal ? reason.trim().length < 15 : row.status !== 'ready')
                  }
                  onClick={() => void act(row)}
                >
                  {busy === row.id
                    ? 'Guardando…'
                    : internal
                      ? 'Validar alcance e importes'
                      : 'Aceptar y solicitar profesional'}
                </Button>
                {internal && onRecalculate ? (
                  <Button variant="secondary" onClick={() => onRecalculate(row)}>
                    Recalcular nueva versión
                  </Button>
                ) : null}
              </div>
            ) : (
              <ButtonLink
                href={
                  internal
                    ? `/admin/calculadora/solicitudes/${row.request_id}`
                    : `/app/solicitudes/${row.request_id}`
                }
                variant="secondary"
              >
                Ver solicitud
              </ButtonLink>
            )}
          </div>
        </details>
      ))}
      {nextCursor ? (
        <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void more()}>
          Cargar más presupuestos
        </Button>
      ) : null}
    </section>
  )
}
