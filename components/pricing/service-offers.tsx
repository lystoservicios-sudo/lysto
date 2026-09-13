'use client'

import { useEffect, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { jobStatusLabels } from '@/lib/domain/job-status-labels'
import type { JobStatus } from '@/lib/domain/types'

type Job = {
  id: string
  request_id: string
  status: JobStatus
  scheduled_date: string | null
  scheduled_time_window: string | null
  assignment_version: number
}
type Offer = {
  id: string
  job_id: string
  status: string
  expires_at: string
  version: number
}
type Candidate = {
  id: string
  firstName: string
  lastName: string
  ratingAvg: number | null
  paymentAccountConnected: boolean
}

function preferredStart(job: Job) {
  const hour = job.scheduled_time_window?.match(/\d{2}/)?.[0] ?? '09'
  return job.scheduled_date ? `${job.scheduled_date}T${hour}:00` : ''
}

function toUtc(value: string) {
  return new Date(`${value}:00-03:00`).toISOString()
}

export function ServiceOffers() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [role, setRole] = useState('')
  const [starts, setStarts] = useState<Record<string, string>>({})
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({})
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    fetch('/api/pricing/offers')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        if (!active) return
        setJobs(data.jobs ?? [])
        setOffers(data.offers ?? [])
        setRole(data.role)
        setStarts(
          Object.fromEntries((data.jobs ?? []).map((job: Job) => [job.id, preferredStart(job)]))
        )
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'No se pudo cargar.')
      })
    return () => {
      active = false
    }
  }, [revision])

  async function findCandidates(job: Job) {
    if (!starts[job.id]) return
    setBusy(true)
    try {
      const query = new URLSearchParams({
        jobId: job.id,
        startsAt: toUtc(starts[job.id]),
        durationMinutes: '120',
        travelBufferMinutes: '30'
      })
      const response = await fetch(`/api/pricing/offers?${query}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setCandidates({ ...candidates, [job.id]: data.candidates })
      setMessage(
        data.candidates.length
          ? 'Disponibilidad verificada. Elegí a quién enviar la propuesta.'
          : 'No hay profesionales habilitados y libres en ese horario.'
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo verificar la capacidad.')
    } finally {
      setBusy(false)
    }
  }

  async function assign(job: Job) {
    setBusy(true)
    try {
      const response = await fetch('/api/pricing/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          jobId: job.id,
          professionalId: chosen[job.id],
          startsAt: toUtc(starts[job.id]),
          durationMinutes: 120,
          travelBufferMinutes: 30,
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          expectedVersion: job.assignment_version
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(
        data.offer.paymentAccountConnected
          ? 'Propuesta enviada. La capacidad queda reservada durante 30 minutos.'
          : 'Propuesta enviada. El profesional deberá vincular su cuenta antes del cobro.'
      )
      setRevision((value) => value + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo enviar la propuesta.')
    } finally {
      setBusy(false)
    }
  }

  async function respond(offer: Offer, response: 'accepted' | 'rejected') {
    setBusy(true)
    try {
      const result = await fetch('/api/pricing/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          offerId: offer.id,
          response,
          reason: response === 'rejected' ? reasons[offer.id] : undefined,
          expectedVersion: offer.version
        })
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.error)
      setMessage(
        data.offer.status === 'accepted'
          ? data.offer.paymentStatus === 'approved'
            ? 'Trabajo aceptado y pago aprobado.'
            : 'Trabajo aceptado. El inicio seguirá bloqueado hasta confirmar el pago.'
          : data.offer.status === 'expired'
            ? 'La propuesta venció y volvió a la cola de asignación.'
            : 'Propuesta rechazada y devuelta a operaciones.'
      )
      setRevision((value) => value + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo responder la propuesta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-black">Propuestas de trabajo</h2>
      {message ? (
        <p role="status" className="text-sm text-blue-800">
          {message}
        </p>
      ) : null}
      {role === 'admin' && !jobs.length ? (
        <Card className="p-5">No hay trabajos por asignar.</Card>
      ) : null}
      {role === 'professional' && !offers.length ? (
        <Card className="p-5">No tenés propuestas pendientes.</Card>
      ) : null}
      {jobs.map((job) => (
        <Card key={job.id} className="space-y-3 p-5">
          <p className="font-bold">
            Visita {job.scheduled_date ?? 'por coordinar'} · {jobStatusLabels[job.status]}
          </p>
          <label className="block text-sm font-semibold">
            Inicio propuesto
            <input
              className="mt-1 block rounded-xl border border-slate-200 p-2"
              type="datetime-local"
              value={starts[job.id] ?? ''}
              onChange={(event) => setStarts({ ...starts, [job.id]: event.target.value })}
            />
          </label>
          <Button disabled={busy || !starts[job.id]} onClick={() => void findCandidates(job)}>
            Verificar profesionales disponibles
          </Button>
          {candidates[job.id] ? (
            <div className="flex flex-wrap gap-3">
              <select
                aria-label="Profesional para la propuesta"
                className="max-w-full rounded-xl border border-slate-200 p-2"
                value={chosen[job.id] ?? ''}
                onChange={(event) => setChosen({ ...chosen, [job.id]: event.target.value })}
              >
                <option value="">Elegir profesional</option>
                {candidates[job.id].map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.firstName} {professional.lastName}
                    {professional.ratingAvg ? ` · ${professional.ratingAvg.toFixed(1)}` : ''}
                    {!professional.paymentAccountConnected ? ' · cuenta de cobro pendiente' : ''}
                  </option>
                ))}
              </select>
              <Button disabled={busy || !chosen[job.id]} onClick={() => void assign(job)}>
                Enviar propuesta por 30 minutos
              </Button>
            </div>
          ) : null}
          <ButtonLink href={`/admin/calculadora/trabajos/${job.id}`} variant="secondary">
            Ver presupuesto y alcance
          </ButtonLink>
        </Card>
      ))}
      {offers.map((offer) => (
        <Card key={offer.id} className="space-y-3 p-5">
          <p className="font-bold">
            {offer.status === 'pending' ? 'Propuesta pendiente' : 'Trabajo aceptado'} · vence{' '}
            {new Date(offer.expires_at).toLocaleString('es-AR')}
          </p>
          <ButtonLink href={`/pro/trabajos/${offer.job_id}`} variant="secondary">
            Revisar presupuesto, alcance y visita
          </ButtonLink>
          {offer.status === 'pending' ? (
            <>
              <textarea
                aria-label="Motivo si rechazás"
                className="block w-full rounded-xl border border-slate-200 p-2"
                placeholder="Motivo del rechazo"
                value={reasons[offer.id] ?? ''}
                onChange={(event) => setReasons({ ...reasons, [offer.id]: event.target.value })}
              />
              <div className="flex gap-3">
                <Button disabled={busy} onClick={() => void respond(offer, 'accepted')}>
                  Aceptar propuesta
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || (reasons[offer.id]?.trim().length ?? 0) < 10}
                  onClick={() => void respond(offer, 'rejected')}
                >
                  Rechazar con motivo
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-amber-800">El inicio requiere pago aprobado.</p>
          )}
        </Card>
      ))}
    </section>
  )
}
