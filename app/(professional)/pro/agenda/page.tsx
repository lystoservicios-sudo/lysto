import { CalendarDays, Clock3 } from 'lucide-react'
import { requirePageSession } from '@/lib/auth/session'
import { getScheduleAvailability } from '@/lib/scheduling/service'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/customer/states'
import { ProPage, ProPanel } from '@/components/pro/pro-ui'

function buenosAiresDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value)
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function visitLabel(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export default async function ProfessionalAgendaPage() {
  const session = await requirePageSession('professional')
  const from = buenosAiresDate()
  const schedule = await getScheduleAvailability(session, {
    professionalId: session.professionalId,
    from,
    to: addUtcDays(from, 31)
  })
  return (
    <ProPage
      title="Tu agenda"
      description="Visitas confirmadas y reservas temporales de los próximos 31 días."
    >
      <div className="pro-two-col">
        <div className="pro-stack">
          {schedule.reservations.map((visit) => (
            <article className="pro-request" key={visit.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold capitalize">{visitLabel(visit.startsAt)}</p>
                  <p className="pro-muted mt-2">
                    <Clock3 size={16} className="mr-2 inline" aria-hidden="true" />
                    Hasta{' '}
                    {new Intl.DateTimeFormat('es-AR', {
                      timeZone: schedule.timezone,
                      hour: '2-digit',
                      minute: '2-digit'
                    }).format(new Date(visit.endsAt))}
                  </p>
                  <p className="pro-muted mt-1">
                    {visit.state === 'confirmed'
                      ? 'Visita confirmada'
                      : `Reserva temporal hasta ${visitLabel(visit.holdExpiresAt!)}`}
                  </p>
                </div>
                <CalendarDays size={22} aria-hidden="true" />
              </div>
              <ButtonLink
                className="mt-4"
                variant="secondary"
                href={`/pro/trabajos/${visit.jobId}`}
              >
                Ver trabajo
              </ButtonLink>
            </article>
          ))}
          {!schedule.reservations.length && (
            <EmptyState
              title="Tu agenda está libre"
              description="No tenés visitas confirmadas ni reservas activas para los próximos 31 días."
              action={<ButtonLink href="/pro/solicitudes">Ver solicitudes</ButtonLink>}
            />
          )}
        </div>
        <ProPanel title="Cómo se confirma una visita">
          <p className="pro-muted">
            La fecha que prefiere el cliente es una referencia. La visita aparece acá cuando Lysto
            verificó tu disponibilidad y reservó la capacidad.
          </p>
          <p className="pro-muted mt-4">
            Para cambiar una visita, abrí el trabajo y proponé una fecha. La agenda se actualiza
            cuando ambas partes la aprueban.
          </p>
        </ProPanel>
      </div>
    </ProPage>
  )
}
