'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'
import { paymentResponse } from './payment-response'

export type AdminPaymentJob = {
  id: string; version: number; status: string; customerName: string
  professionalName: string | null; issueLabel: string; canCharge: boolean; matchesSearch?: boolean
}
type Context = { jobs: AdminPaymentJob[]; commissionRate: number }
type Charge = { jobId: string; concept: string; description: string; amount: number
  commissionMode: 'standard' | 'none'; expectedCommissionRate: number; reason: string }
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
export const paymentJobLabel = (job: AdminPaymentJob) =>
  `${job.customerName} · ${job.issueLabel} · ${job.professionalName ?? 'Sin profesional'} · #${job.id.slice(0, 8)}`

export function AdminChargePanel({ actorKey }: { actorKey: string }) {
  const [context, setContext] = useState<Context | null>(null)
  const [jobId, setJobId] = useState(''), [concept, setConcept] = useState('')
  const [description, setDescription] = useState(''), [amount, setAmount] = useState('')
  const [mode, setMode] = useState<'standard' | 'none'>('standard'), [reason, setReason] = useState('')
  const [review, setReview] = useState<Charge | null>(null), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [error, setError] = useState('')
  const [search, setSearch] = useState(''), [lookup, setLookup] = useState('')
  const lock = useRef(false), memory = useRef(new Map<string, string>())
  const storage = useRef({
    getItem: (key: string) => { try { return memory.current.get(key) ?? sessionStorage.getItem(key) } catch { return memory.current.get(key) ?? null } },
    setItem: (key: string, value: string) => { memory.current.set(key, value); try { sessionStorage.setItem(key, value) } catch { /* keep mounted retry identity */ } },
    removeItem: (key: string) => { memory.current.delete(key); try { sessionStorage.removeItem(key) } catch { /* memory already cleared */ } }
  })
  useEffect(() => {
    let active = true
    setContext(null)
    fetch(`/api/payments/admin-charges${lookup ? `?search=${encodeURIComponent(lookup)}` : ''}`).then(paymentResponse)
      .then(body => { if (active) setContext(body) })
      .catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [lookup])
  const selected = context?.jobs.find(job => job.id === jobId)
  function prepare(event: FormEvent) {
    event.preventDefault()
    if (!context || !selected?.canCharge || lock.current) return
    const parsed = Number(amount.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100000000 ||
        Math.abs(parsed * 100 - Math.round(parsed * 100)) > 0.000001) {
      setError('Ingresá un importe positivo con hasta dos decimales.'); return
    }
    setError(''); setMessage('')
    setReview({ jobId, concept: concept.trim(), description: description.trim(), amount: parsed,
      commissionMode: mode, expectedCommissionRate: mode === 'none' ? 0 : context.commissionRate, reason: reason.trim() })
  }
  async function submit() {
    if (!review || lock.current) return
    lock.current = true; setBusy(true); setError('')
    const scope = `admin-charge:${actorKey}:${review.jobId}`
    try {
      const command = recoverCommand(storage.current, scope, JSON.stringify(review))
      await paymentResponse(await fetch('/api/payments/admin-charges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...review, idempotencyKey: command.key })
      }))
      acknowledgeCommand(storage.current, scope, command.key)
      setReview(null); setConcept(''); setDescription(''); setAmount(''); setReason('')
      setMessage('Solicitud creada. El cliente debe aceptarla y completar el pago desde su servicio.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo confirmar la solicitud. Reintentá con los mismos datos.') }
    finally { lock.current = false; setBusy(false) }
  }
  const reviewJob = context?.jobs.find(job => job.id === review?.jobId)
  const fee = review ? Math.round((review.amount * review.expectedCommissionRate + Number.EPSILON) * 100) / 100 : 0
  return <Card className="space-y-4 p-5">
    <div><h2 className="text-xl font-bold">Crear solicitud de cobro</h2>
      <p className="mt-1 text-sm text-slate-600">Elegí un servicio activo. El cliente recibirá el detalle para aceptar y pagar; crear la solicitud no realiza un débito.</p></div>
    {!context && !error ? <p role="status">Cargando servicios…</p> : null}
    {message ? <p role="status" className="rounded-xl bg-green-50 p-3 text-green-900">{message}</p> : null}
    {error && !review ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-900">{error}</p> : null}
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid min-w-0 flex-1 gap-1">Buscar servicio para cobrar<input maxLength={120} className="rounded-lg border p-3" placeholder="Cliente, profesional o referencia del servicio" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <Button type="button" variant="secondary" disabled={busy || Boolean(review)} onClick={() => { setJobId(''); setError(''); setLookup(search.trim()) }}>Buscar servicios</Button>
    </div>
    <p className="text-xs text-slate-500">Hasta 100 resultados. Para un servicio antiguo, buscá por su referencia o por el nombre del cliente.</p>
    <form onSubmit={prepare}>
      <fieldset disabled={!context || busy || Boolean(review)} className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 md:col-span-2">Servicio a cobrar<select required className="min-w-0 rounded-lg border p-3" value={jobId} onChange={e => setJobId(e.target.value)}>
          <option value="">Seleccionar servicio</option>
          {context?.jobs.filter(job => job.canCharge).map(job => <option key={job.id} value={job.id}>{paymentJobLabel(job)}</option>)}
        </select></label>
        <label className="grid gap-1">Concepto<input required minLength={5} maxLength={500} className="rounded-lg border p-3" value={concept} onChange={e => setConcept(e.target.value)} /></label>
        <label className="grid gap-1">Importe final (ARS)<input required type="number" min="0.01" max="100000000" step="0.01" className="rounded-lg border p-3" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label className="grid gap-1 md:col-span-2">Detalle para el cliente<textarea required minLength={10} maxLength={2000} className="rounded-lg border p-3" value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label className="grid gap-1">Comisión de Lysto<select className="rounded-lg border p-3" value={mode} onChange={e => setMode(e.target.value as 'standard' | 'none')}>
          <option value="standard">Habitual ({((context?.commissionRate ?? 0) * 100).toLocaleString('es-AR')}%)</option>
          <option value="none">Sin comisión Lysto</option>
        </select></label>
        <label className="grid gap-1">Motivo administrativo<input required minLength={10} maxLength={2000} className="rounded-lg border p-3" value={reason} onChange={e => setReason(e.target.value)} /></label>
        <p className="text-sm text-slate-600 md:col-span-2">Ingresá el total acordado. No se agrega otro porcentaje al cliente. La tarifa de Mercado Pago se descuenta de la parte del profesional.</p>
        <Button type="submit" disabled={!selected?.canCharge}>Revisar solicitud de cobro</Button>
      </fieldset>
    </form>
    <Dialog open={Boolean(review)} onOpenChange={open => { if (!open && !busy) setReview(null) }} title="Confirmar solicitud de cobro">
      {review ? <div className="space-y-3">
        <p><strong>Cliente:</strong> {reviewJob?.customerName}</p>
        <p><strong>Profesional:</strong> {reviewJob?.professionalName}</p>
        <p><strong>Servicio:</strong> {reviewJob?.issueLabel} · #{review.jobId.slice(0, 8)}</p>
        <p><strong>{review.concept}</strong><br />{review.description}</p>
        <dl className="space-y-2 rounded-xl bg-slate-50 p-3">
          <div>Total para el cliente: <strong>{money(review.amount)}</strong></div>
          <div>Comisión Lysto: <strong>{money(fee)}</strong></div>
          <div>Profesional antes de cargos: <strong>{money(review.amount - fee)}</strong></div>
        </dl>
        <p className="text-sm">Mercado Pago puede descontar su propia tarifa. El cliente debe aceptar y pagar esta solicitud.</p>
        <p className="text-sm"><strong>Motivo:</strong> {review.reason}</p>
        {error ? <p role="alert" className="text-red-800">{error}</p> : null}
        <Button disabled={busy} onClick={() => void submit()}>{busy ? 'Creando solicitud…' : 'Crear solicitud para el cliente'}</Button>
      </div> : null}
    </Dialog>
  </Card>
}
