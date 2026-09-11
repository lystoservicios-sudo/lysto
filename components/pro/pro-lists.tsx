'use client'

import { useState } from 'react'
import { ArrowRight, CalendarDays, ChevronDown, ClipboardList, Clock3, CreditCard, GraduationCap, LifeBuoy, MapPin, Star, UserRound, Wrench } from 'lucide-react'
import { CountTabs } from '@/components/customer/count-tabs'
import { EmptyState } from '@/components/customer/states'
import { InfoNotice } from '@/components/customer/info-notice'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { StatusPill } from '@/components/business/status-pill'
import { money } from '@/lib/mock/lysto-data'
import { dateNumber,jobGroup,searchMatches } from './pro-model'
import { availableRequests,demoProfessional,professionalJobs,professionalPayments } from '@/lib/mock/pro-scope'
import { ProFacts, ProPage, ProPanel, ProSearch, ProShortcut, VisitCard } from './pro-ui'

export function ProfessionalDashboard() {
  const active = professionalJobs.filter(job => jobGroup(job.status) === 'active')
  const next = [...active].sort((a, b) => dateNumber(a.scheduledDate) - dateNumber(b.scheduledDate))[0]
  return <ProPage title="Tu jornada" description="Tu próxima visita y todo lo que necesitás para resolverla." action={<ButtonLink href="/pro/perfil" variant="secondary" className="hidden md:inline-flex"><UserRound size={18} className="mr-2" aria-hidden="true" />Mi perfil</ButtonLink>}>
    <div className="pro-summary-strip">
      <div><span className="pro-icon"><Wrench size={20} aria-hidden="true" /></span><div><strong>{active.length}</strong><span className="pro-muted">Trabajo activo</span></div></div>
      <div><span className="pro-icon"><ClipboardList size={20} aria-hidden="true" /></span><div><strong>{availableRequests.length}</strong><span className="pro-muted">Solicitud disponible</span></div></div>
      <div><span className="pro-icon"><Star size={20} aria-hidden="true" /></span><div><strong>{demoProfessional.rating.toLocaleString('es-AR')}</strong><span className="pro-muted">Calificación</span></div></div>
    </div>
    <div className="pro-two-col"><div className="pro-stack">
      <div className="flex justify-between items-center gap-3"><h2 className="text-lg font-bold">Tu visita en curso</h2><ButtonLink href="/pro/agenda" variant="ghost" size="sm">Ver agenda<ArrowRight size={16} className="ml-2" aria-hidden="true" /></ButtonLink></div>
      {next ? <VisitCard job={next} featured /> : <EmptyState title="Sin visitas activas" description="Podés revisar las solicitudes disponibles para organizar tu próxima jornada." action={<ButtonLink href="/pro/solicitudes">Ver solicitudes</ButtonLink>} />}
      <InfoNotice title="Una oportunidad para revisar" description="Consultá el horario y el problema antes de decidir. Los importes de las solicitudes son totales del servicio." action={<ButtonLink href="/pro/solicitudes" variant="secondary">Ver solicitudes</ButtonLink>} />
    </div><div className="pro-stack">
      <ProPanel title="A mano"><ProShortcut href="/pro/pagos" title="Mis cobros" description="Importes, comisión y neto." icon={CreditCard} /><ProShortcut href="/pro/capacitacion" title="Guías de trabajo" description="Prepará cada visita con claridad." icon={GraduationCap} /><ProShortcut href="/pro/soporte" title="Necesito ayuda" description="Respuestas según tu situación." icon={LifeBuoy} /></ProPanel>
      <ProPanel title="Tu perfil profesional"><div className="flex items-center gap-3 mb-5"><span className="pro-icon font-bold">MG</span><div><p className="font-bold">{demoProfessional.name}</p><p className="pro-muted">{demoProfessional.specialty}</p></div></div><ProFacts items={[{ label: 'Zona', value: demoProfessional.zone }, { label: 'Movilidad', value: demoProfessional.mobility }]} /></ProPanel>
    </div></div>
  </ProPage>
}

export function ProfessionalRequests() {
  const [query, setQuery] = useState('')
  const [urgency, setUrgency] = useState('all')
  const requests = availableRequests.filter(item => searchMatches(query, item.customer, item.issueLabel, item.address, item.id) && (urgency === 'all' || item.urgency === urgency))
  return <ProPage title="Solicitudes disponibles" description="Revisá el problema, la zona y el horario antes de responder.">
    <div className="pro-toolbar"><ProSearch label="Buscar solicitudes" value={query} onChange={setQuery} /><CountTabs label="Prioridad de solicitudes" panelId="requests-panel" value={urgency} onValueChange={setUrgency} items={[{ id: 'all', label: 'Todas', count: availableRequests.length }, { id: 'priority', label: 'Prioritarias', count: availableRequests.filter(item => item.urgency === 'priority').length }]} /></div>
    <div className="pro-two-col"><div id="requests-panel" role="tabpanel" aria-labelledby={`tab-${urgency}`} className="pro-stack">
      {requests.map(request => <article className="pro-request" key={request.id}>
        <div className="flex flex-wrap gap-2 justify-between items-center mb-5"><Badge tone={request.urgency === 'priority' ? 'amber' : 'blue'}>{request.urgency === 'priority' ? 'Prioritaria' : 'Horario flexible'}</Badge><span className="pro-muted">{request.id.replace('req_', '#')}</span></div>
        <h2>{request.issueLabel}</h2><p className="mt-1 font-semibold">{request.customer}</p>
        <div className="pro-facts mt-5"><p className="pro-muted flex items-start gap-2"><MapPin size={18} className="shrink-0" aria-hidden="true" />{request.address.split(',').slice(-1)[0]}</p><p className="pro-muted flex gap-2"><Clock3 size={18} className="shrink-0" aria-hidden="true" />{request.timeWindow}</p></div>
        <p className="pro-muted mt-4">{request.property} · {request.mediaCount} archivo adjunto{request.mediaCount !== 1 ? 's' : ''}</p>
        <div className="pro-request-footer"><div><p className="pro-muted">Total del servicio</p><strong>{money(request.price)}</strong><p className="pro-muted">Antes de comisión</p></div><ButtonLink href={`/pro/solicitudes/${request.id}`}>Revisar solicitud<ArrowRight size={17} className="ml-2" aria-hidden="true" /></ButtonLink></div>
      </article>)}
      {!requests.length && <EmptyState title="No hay solicitudes con estos filtros" description="Probá con otra búsqueda o consultá todas las solicitudes disponibles." action={<Button variant="secondary" onClick={() => { setQuery(''); setUrgency('all') }}>Limpiar filtros</Button>} />}
    </div><ProPanel title="Antes de responder"><ol className="space-y-5 text-sm leading-6"><li className="flex gap-3"><CalendarDays className="shrink-0 text-blue-700" size={20} aria-hidden="true" /><span><strong>Revisá tu agenda.</strong><br />Contemplá el traslado entre visitas.</span></li><li className="flex gap-3"><Wrench className="shrink-0 text-blue-700" size={20} aria-hidden="true" /><span><strong>Prepará tus herramientas.</strong><br />El diagnóstico inicial es orientativo.</span></li><li className="flex gap-3"><CreditCard className="shrink-0 text-blue-700" size={20} aria-hidden="true" /><span><strong>Revisá el importe.</strong><br />El monto publicado incluye la comisión.</span></li></ol><ButtonLink href="/pro/agenda" variant="secondary" className="w-full mt-6">Consultar mi agenda</ButtonLink></ProPanel></div>
  </ProPage>
}

export function ProfessionalJobs() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('active')
  const filtered = professionalJobs.filter(job => jobGroup(job.status) === group && searchMatches(query, job.customer, job.address, job.issueLabel, job.id))
  return <ProPage title="Mis trabajos" description="Seguí cada visita y encontrá el historial de tus servicios." action={<ButtonLink href="/pro/agenda" variant="secondary"><CalendarDays size={18} className="mr-2" aria-hidden="true" />Mi agenda</ButtonLink>}>
    <div className="pro-toolbar"><CountTabs label="Estado de trabajos" panelId="jobs-panel" value={group} onValueChange={setGroup} items={([{ id: 'active', label: 'Activos' }, { id: 'closing', label: 'Por confirmar' }, { id: 'finished', label: 'Finalizados' }] as const).map(item => ({ ...item, count: professionalJobs.filter(job => jobGroup(job.status) === item.id).length }))} /><ProSearch label="Buscar trabajos" value={query} onChange={setQuery} /></div>
    <div id="jobs-panel" role="tabpanel" aria-labelledby={`tab-${group}`} className="pro-stack">{filtered.map(job => <VisitCard key={job.id} job={job} />)}{!filtered.length && <EmptyState title="No encontramos trabajos" description="No hay visitas para esta selección. Podés cambiar de estado o limpiar la búsqueda." action={<Button variant="secondary" onClick={() => { setQuery(''); setGroup('active') }}>Limpiar filtros</Button>} />}</div>
  </ProPage>
}

export function ProfessionalAgenda() {
  const [group, setGroup] = useState('active')
  const selected = professionalJobs.filter(job => group === 'all' || jobGroup(job.status) === 'active')
  const dates = [...new Set(selected.map(job => job.scheduledDate))].sort((a, b) => group === 'active' ? dateNumber(a) - dateNumber(b) : dateNumber(b) - dateNumber(a))
  return <ProPage title="Mi agenda" description="Tus visitas por fecha, con el horario y la dirección siempre a mano.">
    <CountTabs label="Visitas de agenda" panelId="agenda-panel" value={group} onValueChange={setGroup} items={[{ id: 'active', label: 'Pendientes', count: professionalJobs.filter(job => jobGroup(job.status) === 'active').length }, { id: 'all', label: 'Todas', count: professionalJobs.length }]} />
    <div className="pro-two-col"><div id="agenda-panel" role="tabpanel" aria-labelledby={`tab-${group}`} className="pro-stack">{dates.map(date => <section key={date}><div className="pro-schedule-day"><span>{date.split('/')[0]}</span><div><h2 className="font-bold">{date}</h2><p className="pro-muted">{selected.filter(job => job.scheduledDate === date).length} visita registrada</p></div></div><div className="pro-stack">{selected.filter(job => job.scheduledDate === date).map(job => <VisitCard job={job} key={job.id} />)}</div></section>)}{!dates.length && <EmptyState title="Tu agenda está libre" description="No hay visitas pendientes en los datos disponibles." action={<ButtonLink href="/pro/solicitudes">Ver solicitudes</ButtonLink>} />}</div><ProPanel title="Organizá tu jornada"><p className="pro-muted">Las fechas corresponden a los registros demostrativos; no representan la agenda de hoy.</p><div className="mt-5"><ProShortcut href="/pro/perfil" title="Zona y disponibilidad" description="Revisá tus preferencias de trabajo." icon={MapPin} /><ProShortcut href="/pro/soporte" title="¿Necesitás reprogramar?" description="Consultá cómo informar un imprevisto." icon={LifeBuoy} /></div></ProPanel></div>
  </ProPage>
}

export function ProfessionalPayments() {
  const [group, setGroup] = useState('all')
  const total = professionalPayments.reduce((sum, item) => sum + item.amount, 0)
  const fee = professionalPayments.reduce((sum, item) => sum + item.platformFee, 0)
  const net = total - fee
  const filtered = professionalPayments.filter(payment => group === 'all' || payment.status === group)
  return <ProPage title="Mis cobros" description="Entendé cuánto pagó el cliente, la comisión y el neto de cada servicio." action={<ButtonLink href="/pro/mercadopago" variant="secondary"><CreditCard size={18} className="mr-2" aria-hidden="true" />Cuenta de cobro</ButtonLink>}>
    <div className="pro-two-col"><ProPanel title="Resumen de tus servicios" description="Importes registrados · ARS"><p className="pro-muted">Neto acumulado</p><p className="pro-money-total">{money(net)}</p><div className="pro-split-bar" aria-hidden="true"><span style={{ width: `${total ? net / total * 100 : 0}%` }} /></div><ProFacts items={[{ label: 'Total abonado por clientes', value: money(total) }, { label: 'Comisión Lysto', value: money(fee) }]} /><p className="pro-muted mt-5">Este neto no equivale a saldo disponible. La liquidación y la fecha de acreditación no están informadas.</p></ProPanel><InfoNotice title="Trazabilidad, sin sorpresas" description="Abrí cada movimiento para ver cómo se compone. Los pagos son demostrativos: no se realizan transferencias desde esta pantalla." /></div>
    <ProPanel title="Movimientos" description="Sólo los servicios de tu perfil demostrativo"><CountTabs label="Estado de cobros" panelId="payments-panel" value={group} onValueChange={setGroup} items={[{ id: 'all', label: 'Todos', count: professionalPayments.length }, { id: 'approved', label: 'Aprobados', count: professionalPayments.filter(item => item.status === 'approved').length }, { id: 'captured', label: 'Capturados', count: professionalPayments.filter(item => item.status === 'captured').length }]} />
      <div id="payments-panel" role="tabpanel" aria-labelledby={`tab-${group}`} className="mt-5">{filtered.map(payment => <details className="pro-payment-row" key={payment.id}><summary><div className="min-w-0"><strong>{payment.customer}</strong><p className="pro-muted mt-1">{payment.createdAt.split(' ')[0]} · {payment.jobId.replace('job_', '#')}</p><div className="mt-2"><StatusPill status={payment.status} /></div></div><span className="text-right shrink-0"><span className="pro-muted block">Tu neto</span><strong className="text-xl tabular-nums">{money(payment.professionalAmount)}</strong><ChevronDown size={18} className="ml-auto mt-2 text-slate-500" aria-hidden="true" /></span></summary><ProFacts items={[{ label: 'Pago del cliente', value: money(payment.amount) }, { label: 'Comisión', value: money(payment.platformFee) }, { label: 'Medio de pago', value: 'Mercado Pago' }, { label: 'Liquidación', value: 'No informada' }]} /><ButtonLink className="mt-5" variant="secondary" href={`/pro/trabajos/${payment.jobId}`}>Ver trabajo</ButtonLink></details>)}{!filtered.length && <EmptyState title="Sin movimientos" description="Todavía no hay cobros en este estado." compact />}</div>
    </ProPanel><ButtonLink href="/pro/soporte" variant="ghost" className="self-start"><LifeBuoy size={18} className="mr-2" aria-hidden="true" />Tengo una consulta sobre un cobro</ButtonLink>
  </ProPage>
}
