'use client'
import { useEffect, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { QuoteInput, ServiceQuote } from '@/lib/pricing/service-quote'
import { QuoteBreakdown } from './quote-breakdown'
type SavedQuote = { id: string; customer_id: string; input: QuoteInput; address: { street: string; number: string; city: string; province: string }; quote: ServiceQuote; status: string; request_id: string | null; expires_at: string }
export function SavedQuotes({ internal = false, revision = 0, onRecalculate }: { internal?: boolean; revision?: number; onRecalculate?: (quote: SavedQuote) => void }) {
  const [rows, setRows] = useState<SavedQuote[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [reason, setReason] = useState('')
  useEffect(() => {
    let active = true
    fetch('/api/pricing/quotes').then(async res => { const data = await res.json(); if (!active) return; if (res.ok) { setRows(data.quotes) } else setMessage(data.error) }).catch(() => { if (active) setMessage('No se pudieron consultar los presupuestos.') })
    return () => { active = false }
  }, [revision, refresh])
  async function act(row: SavedQuote) {
    if (busy) return
    setBusy(row.id)
    try {
      const response = await fetch(internal ? '/api/pricing/quotes' : '/api/customer/request/submit', { method: internal ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(internal ? { quoteId: row.id, reason } : { quoteId: row.id }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setRefresh(value => value + 1); setMessage(internal ? 'Alcance verificado. El cliente ya puede aceptar este presupuesto.' : 'Solicitud registrada y pendiente de asignación. No se realizó ningún cobro.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo completar.') }
    finally { setBusy(null) }
  }
  return <section className="space-y-4"><h2 className="text-2xl font-black">Presupuestos guardados</h2>{message ? <p role="status" className="text-sm text-blue-800">{message}</p> : null}
    {!rows.length ? <Card className="p-5 text-sm text-slate-600">No hay presupuestos disponibles para esta cuenta.</Card> : null}
    {internal ? <label className="block text-sm font-semibold">Verificación de alcance, costos y exclusiones<Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Documentá qué importes y condiciones verificaste" /></label> : null}
    {rows.map(row => <details key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold">{row.address.street} {row.address.number} · {row.quote.scope} · $ {row.quote.total.toLocaleString('es-AR')} · {row.status === 'accepted' ? 'Aceptado' : row.status === 'ready' ? 'Listo para aceptar' : 'En revisión'}</summary><div className="mt-4 space-y-4"><QuoteBreakdown quote={row.quote} internal={internal} status={row.status} /><p className="text-xs text-slate-500">Vence: {new Date(row.expires_at).toLocaleString('es-AR')}</p>
      {row.status !== 'accepted' ? <div className="flex flex-wrap gap-3"><Button disabled={Boolean(busy) || Date.parse(row.expires_at) <= Date.now() || (internal ? reason.trim().length < 15 : row.status !== 'ready')} onClick={() => void act(row)}>{busy === row.id ? 'Guardando…' : internal ? 'Validar alcance e importes' : 'Aceptar y solicitar profesional'}</Button>{internal && onRecalculate ? <Button variant="secondary" onClick={() => onRecalculate(row)}>Recalcular nueva versión</Button> : null}</div> : <ButtonLink href={internal ? `/admin/calculadora/solicitudes/${row.request_id}` : `/app/solicitudes/${row.request_id}`} variant="secondary">Ver solicitud</ButtonLink>}
    </div></details>)}
  </section>
}
