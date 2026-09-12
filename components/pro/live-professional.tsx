'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, CreditCard, LifeBuoy, UserRound, Wrench } from 'lucide-react'

import { CountTabs } from '@/components/customer/count-tabs'
import { EmptyState } from '@/components/customer/states'
import { ButtonLink } from '@/components/ui/button'
import type { ProfessionalLiveJob } from '@/lib/professional/live-model'
import { ProFacts, ProPage, ProPanel, ProSearch, ProShortcut } from './pro-ui'

const finished = new Set([
  'completed',
  'cancelled_by_customer',
  'cancelled_by_professional',
  'cancelled_by_admin'
])
const confirmation = new Set([
  'waiting_customer_approval',
  'completed_pending_customer_confirmation'
])
const money = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
function group(status: string) {
  return finished.has(status) ? 'finished' : confirmation.has(status) ? 'closing' : 'active'
}

function LiveVisit({ job }: { job: ProfessionalLiveJob }) {
  return (
    <article className="pro-visit">
      <div className="pro-visit-top">
        <span className="pro-visit-date">
          <CalendarDays size={17} aria-hidden="true" />
          {new Date(job.scheduledDate).toLocaleDateString('es-AR')} · {job.timeWindow}
        </span>
        <strong>{job.statusLabel}</strong>
      </div>
      <div className="pro-visit-body">
        <div className="pro-visit-main">
          <h2>{job.issueLabel}</h2>
          <p className="pro-muted mt-3">{job.address}</p>
        </div>
        <div className="pro-visit-amount">
          <span className="pro-muted">Importe final</span>
          <strong>{job.finalAmount === null ? 'Por confirmar' : money(job.finalAmount)}</strong>
        </div>
      </div>
      <div className="pro-visit-footer">
        <span className="pro-muted">Estado confirmado por Lysto</span>
        <ButtonLink href={`/pro/trabajos/${job.id}`} variant="secondary">
          Abrir trabajo
        </ButtonLink>
      </div>
    </article>
  )
}

export function LiveProfessionalDashboard({
  name,
  rating,
  jobs
}: {
  name: string
  rating: number | null
  jobs: ProfessionalLiveJob[]
}) {
  const active = jobs.filter((job) => group(job.status) === 'active')
  return (
    <ProPage title={`Hola, ${name}`} description="Tu jornada y tus operaciones confirmadas.">
      <div className="pro-summary-strip">
        <div>
          <span className="pro-icon">
            <Wrench size={20} />
          </span>
          <div>
            <strong>{active.length}</strong>
            <span className="pro-muted">Trabajos activos</span>
          </div>
        </div>
        <div>
          <span className="pro-icon">
            <UserRound size={20} />
          </span>
          <div>
            <strong>{rating?.toFixed(1) ?? '—'}</strong>
            <span className="pro-muted">Calificación</span>
          </div>
        </div>
      </div>
      <div className="pro-two-col">
        <div className="pro-stack">
          {active[0] ? (
            <LiveVisit job={active[0]} />
          ) : (
            <EmptyState
              title="Sin visitas activas"
              description="Las propuestas pendientes aparecen en Presupuestos."
              action={<ButtonLink href="/pro/presupuestos">Ver propuestas</ButtonLink>}
            />
          )}
        </div>
        <ProPanel title="A mano">
          <ProShortcut
            href="/pro/pagos"
            title="Mis cobros"
            description="Estados e importes confirmados."
            icon={CreditCard}
          />
          <ProShortcut
            href="/pro/soporte"
            title="Soporte"
            description="Crear y seguir consultas."
            icon={LifeBuoy}
          />
        </ProPanel>
      </div>
    </ProPage>
  )
}

export function LiveProfessionalJobs({ jobs }: { jobs: ProfessionalLiveJob[] }) {
  const [filter, setFilter] = useState('active'),
    [query, setQuery] = useState('')
  const visible = useMemo(
    () =>
      jobs.filter(
        (job) =>
          group(job.status) === filter &&
          `${job.issueLabel} ${job.address} ${job.id}`.toLowerCase().includes(query.toLowerCase())
      ),
    [filter, jobs, query]
  )
  const tabs = (['active', 'closing', 'finished'] as const).map((id) => ({
    id,
    label: id === 'active' ? 'Activos' : id === 'closing' ? 'Por confirmar' : 'Finalizados',
    count: jobs.filter((job) => group(job.status) === id).length
  }))
  return (
    <ProPage
      title="Mis trabajos"
      description="Seguimiento real de las visitas asignadas a tu perfil."
    >
      <div className="pro-toolbar">
        <CountTabs
          label="Estado de trabajos"
          panelId="jobs-panel"
          value={filter}
          onValueChange={setFilter}
          items={tabs}
        />
        <ProSearch label="Buscar trabajos" value={query} onChange={setQuery} />
      </div>
      <div id="jobs-panel" className="pro-stack">
        {visible.map((job) => (
          <LiveVisit key={job.id} job={job} />
        ))}
        {!visible.length ? (
          <EmptyState
            title="No hay trabajos en este estado"
            description="Cambiá el filtro para consultar el resto de tu historial."
          />
        ) : null}
      </div>
    </ProPage>
  )
}

export function LiveProfessionalProfile({
  profile
}: {
  profile: {
    first_name: string
    last_name: string
    email: string
    phone: string | null
    status: string
    rating_avg: number | null
    jobs_completed: number
    years_experience: number
    acceptance_rate: number
    base_location: string | null
    has_mobility: boolean
    mobility_type: string | null
    license_number: string | null
    license_expires_at: string | null
    bio: string | null
  }
}) {
  return (
    <ProPage title="Mi perfil" description="Datos operativos registrados y estado de habilitación.">
      <div className="pro-two-col">
        <ProPanel title={`${profile.first_name} ${profile.last_name}`}>
          <ProFacts
            items={[
              { label: 'Estado', value: profile.status },
              { label: 'Email', value: profile.email },
              { label: 'Teléfono', value: profile.phone ?? 'No informado' },
              {
                label: 'Calificación',
                value: profile.rating_avg?.toFixed(1) ?? 'Sin calificaciones'
              },
              { label: 'Trabajos completados', value: profile.jobs_completed },
              { label: 'Experiencia', value: `${profile.years_experience} años` },
              { label: 'Aceptación', value: `${Math.round(profile.acceptance_rate * 100)}%` },
              { label: 'Zona base', value: profile.base_location ?? 'No informada' },
              {
                label: 'Movilidad',
                value: profile.has_mobility ? (profile.mobility_type ?? 'Sí') : 'No'
              },
              { label: 'Matrícula', value: profile.license_number ?? 'No registrada' },
              {
                label: 'Vencimiento de matrícula',
                value: profile.license_expires_at ?? 'No informado'
              }
            ]}
          />
        </ProPanel>
        <ProPanel title="Documentación">
          <p className="pro-muted">
            La documentación sensible se gestiona desde el expediente seguro de onboarding. Si un
            dato venció, soporte y operaciones deben revisarlo antes de reactivar el perfil.
          </p>
          <ButtonLink href="/pro/soporte" className="mt-5" variant="secondary">
            Solicitar actualización
          </ButtonLink>
        </ProPanel>
      </div>
    </ProPage>
  )
}
