'use client'
import { useEffect, useState } from 'react'
import { jobStatusLabels } from '@/lib/mock/lysto-data'
import type { JobStatus } from '@/lib/domain/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import type { ServiceQuote } from '@/lib/pricing/service-quote'
import { QuoteBreakdown } from './quote-breakdown'
import { PaymentPanel } from '@/components/payments/payment-panel'
type Extra = { id: string; fault: string; description: string; amount: number; status: string }
type JobData = { role: string; job: { id: string; status: string }; savedQuote: { status: string; quote: ServiceQuote; address: { street: string; number: string; floor?: string; apartment?: string; city: string } } | null; extras: Extra[] }
export function JobQuotePanel({ jobId, requestId }: { jobId?: string; requestId?: string }) {
  const [data, setData] = useState<JobData | null>(null)
  const [message, setMessage] = useState('Cargando presupuesto…')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [fault, setFault] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [attempt, setAttempt] = useState<{ fingerprint: string; key: string } | null>(null)
  useEffect(() => {
    let active = true
    fetch(`/api/pricing/job?${jobId ? `jobId=${encodeURIComponent(jobId)}` : `requestId=${encodeURIComponent(requestId ?? '')}`}`).then(async res => { const body = await res.json(); if (!active) return; if (!res.ok) throw new Error(body.error); setData(body); setMessage('') }).catch(error => { if (active) { setData(null); setMessage(error.message) } })
    return () => { active = false }
  }, [jobId,requestId,revision])
  async function mutate(url: string, method: string, payload: unknown) {
    if (busy) return
    setBusy(true)
    try { const response = await fetch(url,{ method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setRevision(n=>n+1); setMessage('Operación registrada. No implica cobro.'); if (url.includes('extras') && method === 'POST') { setFault('');setDescription('');setAmount('');setAttempt(null) } }
    catch(error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar.') }
    finally { setBusy(false) }
  }
  function propose() {
    if (!data) return
    const fingerprint = JSON.stringify({fault,description,amount})
    const key = attempt?.fingerprint === fingerprint ? attempt.key : crypto.randomUUID()
    setAttempt({fingerprint,key})
    void mutate('/api/jobs/extras','POST',{jobId:data.job.id,fault,description,amount:Number(amount),idempotencyKey:key})
  }
  return <div className="space-y-5"><h1 className="text-3xl font-black">Presupuesto y adicionales</h1>{message ? <p role="status" className="text-sm text-blue-800">{message}</p> : null}{data ? <>
    <Card className="space-y-2 p-5"><p className="font-bold">Estado: {jobStatusLabels[data.job.status as JobStatus] ?? data.job.status}</p>{data.savedQuote ? <p>{data.savedQuote.address.street} {data.savedQuote.address.number} · {data.savedQuote.address.city} {data.savedQuote.address.floor ? `· Piso ${data.savedQuote.address.floor}` : ''} {data.savedQuote.address.apartment ? `· Depto. ${data.savedQuote.address.apartment}` : ''}</p> : null}<p className="text-sm text-slate-600">El presupuesto original queda guardado. Otra falla requiere una propuesta adicional y la aceptación del cliente.</p></Card>
    {data.savedQuote ? <QuoteBreakdown quote={data.savedQuote.quote} internal={data.role !== 'customer'} status={data.savedQuote.status} /> : null}
    <PaymentPanel jobId={data.job.id} jobStatus={data.job.status} role={data.role} extras={data.extras}/>
    {data.role === 'professional' && data.job.status === 'pending_professional_acceptance' ? <Card className="space-y-4 p-5"><h2 className="text-xl font-bold">Responder a la propuesta</h2><Button disabled={busy} onClick={()=>void mutate('/api/pricing/offers','POST',{jobId:data.job.id,action:'accepted'})}>Aceptar trabajo por el importe indicado</Button><Field label="Motivo de rechazo"><Input value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)} /></Field><Button variant="secondary" disabled={busy || rejectionReason.trim().length<3} onClick={()=>void mutate('/api/pricing/offers','POST',{jobId:data.job.id,action:'rejected',reason:rejectionReason})}>Rechazar y devolver a asignación</Button></Card> : null}
    {data.role === 'professional' && ['confirmed','technician_on_way','arrived','onsite_diagnosis'].includes(data.job.status) ? <Button disabled={busy} onClick={()=>void mutate('/api/pricing/job/status','POST',{jobId:data.job.id,expectedStatus:data.job.status})}>{({confirmed:'Marcar en camino',technician_on_way:'Confirmar llegada',arrived:'Iniciar diagnóstico',onsite_diagnosis:'Iniciar trabajo'})[data.job.status]}</Button> : null}
    <Card className="space-y-4 p-5"><h2 className="text-xl font-bold">Fallas adicionales</h2><p className="text-sm text-slate-600">El 100% del importe acordado corresponde al profesional. Comisión Lysto: $0. Registrar o aceptar un adicional no confirma su pago.</p>
      {!data.extras.length ? <p className="text-sm text-slate-500">No hay adicionales registrados.</p> : data.extras.map(extra=><div key={extra.id} className="space-y-2 border-t border-slate-200 pt-4"><h3 className="font-bold">{extra.fault} · $ {extra.amount.toLocaleString('es-AR')}</h3><p className="text-sm">{extra.description}</p><p className="text-xs font-semibold">{extra.status==='proposed'?'Pendiente de aceptación':extra.status==='accepted'?'Aceptado por el cliente':'Rechazado por el cliente'}</p>{data.role==='customer' && extra.status==='proposed'?<div className="flex gap-3"><Button disabled={busy} onClick={()=>void mutate('/api/jobs/extras','PATCH',{extraId:extra.id,decision:'accepted'})}>Aceptar adicional</Button><Button variant="secondary" disabled={busy} onClick={()=>void mutate('/api/jobs/extras','PATCH',{extraId:extra.id,decision:'rejected'})}>Rechazar adicional</Button></div>:null}</div>)}
      {data.role==='professional' && ['arrived','onsite_diagnosis','waiting_customer_approval','in_progress'].includes(data.job.status)?<div className="space-y-3 border-t border-slate-200 pt-4"><Field label="Nueva falla detectada"><Input value={fault} onChange={e=>setFault(e.target.value)} /></Field><Field label="Trabajo adicional y materiales incluidos"><Input value={description} onChange={e=>setDescription(e.target.value)} /></Field><Field label="Importe adicional para el profesional"><Input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} /></Field><Button disabled={busy || fault.trim().length<5 || description.trim().length<10 || Number(amount)<=0} onClick={propose}>Registrar propuesta adicional</Button></div>:null}
    </Card></>:null}</div>
}
