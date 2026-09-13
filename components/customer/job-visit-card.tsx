'use client'

import { FormEvent, useMemo, useState } from 'react'
import { CalendarDays, MapPin, UserRound } from 'lucide-react'

import { Button, ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'

export type CustomerJobVisit = {
  scheduleVersion: number
  startsAt: string
  endsAt: string
  timezone: 'America/Argentina/Buenos_Aires'
  addressLabel: string
  professionalName: string
  durationMinutes: number
  travelBufferMinutes: number
  confirmed: true
}

export type RescheduleRequest = {
  startsAt: string
  durationMinutes: number
  travelBufferMinutes: number
  reason: string
  expectedVersion: number
}

function visitPart(value: string, timezone: string, part: 'date' | 'time') {
  return new Intl.DateTimeFormat(
    'es-AR',
    part === 'date'
      ? { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric' }
      : { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }
  )
    .format(new Date(value))
    .replace(',', '')
}

function buenosAiresInstant(value: string) {
  return new Date(`${value}:00-03:00`).toISOString()
}

export function JobVisitCard({
  jobId,
  visit,
  onReschedule
}: {
  jobId: string
  visit: CustomerJobVisit | null
  onReschedule?: (request: RescheduleRequest) => Promise<void>
}) {
  const [startsAt, setStartsAt] = useState('')
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const directions = useMemo(
    () =>
      visit
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.addressLabel)}`
        : '',
    [visit]
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!visit || !onReschedule || sending || reason.trim().length < 15 || !startsAt) return
    setSending(true)
    try {
      await onReschedule({
        startsAt: buenosAiresInstant(startsAt),
        durationMinutes: visit.durationMinutes,
        travelBufferMinutes: visit.travelBufferMinutes,
        reason: reason.trim(),
        expectedVersion: visit.scheduleVersion
      })
      setStartsAt('')
      setReason('')
    } finally {
      setSending(false)
    }
  }

  if (!visit)
    return (
      <Card id="agenda" className="space-y-2 p-5" tabIndex={-1}>
        <h2 className="text-xl font-black">Visita del servicio</h2>
        <p className="text-sm text-slate-600">
          La fecha de la visita todavía no está confirmada.
        </p>
      </Card>
    )

  const date = visitPart(visit.startsAt, visit.timezone, 'date')
  const time = `${visitPart(visit.startsAt, visit.timezone, 'time')}–${visitPart(visit.endsAt, visit.timezone, 'time')}`

  return (
    <Card id="agenda" className="space-y-5 p-5" tabIndex={-1}>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
          Visita confirmada
        </p>
        <h2 className="mt-1 text-2xl font-black">Tu próximo servicio</h2>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex gap-3">
          <CalendarDays aria-hidden="true" className="mt-0.5 h-5 w-5 text-blue-700" />
          <div>
            <dt className="font-bold text-slate-950">Fecha y horario</dt>
            <dd className="mt-1 text-slate-600">
              <span>{date}</span>
              <br />
              <span>{time}</span>
            </dd>
          </div>
        </div>
        <div className="flex gap-3">
          <UserRound aria-hidden="true" className="mt-0.5 h-5 w-5 text-blue-700" />
          <div>
            <dt className="font-bold text-slate-950">Profesional</dt>
            <dd className="mt-1 text-slate-600">{visit.professionalName}</dd>
          </div>
        </div>
        <div className="flex gap-3 sm:col-span-2">
          <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 text-blue-700" />
          <div>
            <dt className="font-bold text-slate-950">Dirección</dt>
            <dd className="mt-1 text-slate-600">{visit.addressLabel}</dd>
          </div>
        </div>
      </dl>
      <a
        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
        href={directions}
        target="_blank"
        rel="noreferrer"
      >
        Cómo llegar
      </a>
      <form id="reprogramacion" className="space-y-3 border-t pt-5" onSubmit={submit}>
        <h3 className="font-black">Solicitar otra fecha</h3>
        <p className="text-sm text-slate-600">
          La fecha actual sigue vigente hasta que la otra parte acepte el cambio en Lysto.
        </p>
        <Field label="Nueva fecha y hora">
          <Input
            aria-label="Nueva fecha y hora"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </Field>
        <Field label="Motivo de la reprogramación">
          <Textarea
            aria-label="Motivo de la reprogramación"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Button
          type="submit"
          disabled={!onReschedule || sending || !startsAt || reason.trim().length < 15}
        >
          {sending ? 'Enviando solicitud' : 'Solicitar reprogramación'}
        </Button>
      </form>
      <div id="contacto" className="space-y-2 border-t pt-5" tabIndex={-1}>
        <h3 className="font-black">¿Necesitás ayuda con esta visita?</h3>
        <p className="text-sm text-slate-600">
          El equipo de Lysto recibe el caso dentro de tu cuenta y conserva el seguimiento.
        </p>
        <ButtonLink href={`/app/garantias?jobId=${jobId}`} variant="secondary">
          Contactar a soporte de Lysto
        </ButtonLink>
      </div>
    </Card>
  )
}
