'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRight, CalendarDays, ClipboardList, CreditCard, Users, Wrench } from 'lucide-react'
import { customers, equipment, jobs, money, payments, professionals, requests, type JobRecord, type ServiceRequestRecord } from '@/lib/mock/lysto-data'
import { ActionLink, Badge, Button, DataTable, Facts, Header, Metrics, Notice, Panel, Person, Tabs } from './admin-ui'

export function RequestTable({ rows = requests }: { rows?: ServiceRequestRecord[] }) {
  return <DataTable title="Solicitudes" rows={rows} search={r => [r.id, r.customer, r.issueLabel, r.address]} filters={[{ label: 'Estado', value: r => r.status }, { label: 'Prioridad', value: r => r.urgency }]} columns={[
    { key: 'request', label: 'Solicitud / cliente', render: r => <><Link href={`/admin/solicitudes/${r.id}`}>{r.id.toUpperCase()}</Link><Person name={r.customer} detail={r.address} /></> },
    { key: 'issue', label: 'Servicio', render: r => <><strong>{r.issueLabel}</strong><small>Aire acondicionado</small></> },
    { key: 'priority', label: 'Prioridad', render: r => <Badge value={r.urgency} /> },
    { key: 'status', label: 'Estado', render: r => <Badge value={r.status} /> },
    { key: 'amount', label: 'Importe', render: r => <><strong>{money(r.price)}</strong><small>{r.timeWindow}</small></> },
    { key: 'action', label: 'Acción', render: r => <ActionLink href={`/admin/solicitudes/${r.id}`}>Ver detalle <ArrowUpRight size={14} /></ActionLink> }
  ]} />
}
export function JobTable({ rows = jobs }: { rows?: JobRecord[] }) {
  return <DataTable title="Trabajos" rows={rows} search={r => [r.id, r.customer, r.professional, r.address, r.issueLabel]} filters={[{ label: 'Estado', value: r => r.status }]} columns={[
    { key: 'job', label: 'Trabajo', render: r => <><Link href={`/admin/trabajos/${r.id}`}>{r.id.toUpperCase()}</Link><strong>{r.issueLabel}</strong><small>{r.customer}</small></> },
    { key: 'professional', label: 'Profesional', render: r => <Person name={r.professional} detail={r.address} /> },
    { key: 'date', label: 'Visita', render: r => <><strong>{r.scheduled}</strong><small>{r.timeWindow}</small></> },
    { key: 'status', label: 'Estado', render: r => <Badge value={r.status} /> },
    { key: 'payment', label: 'Pago', render: r => <><strong>{money(r.amount)}</strong><Badge value={r.paymentStatus} /></> },
    { key: 'action', label: 'Próximo paso', render: r => <ActionLink href={`/admin/trabajos/${r.id}`}>Gestionar</ActionLink> }
  ]} />
}
export function RequestsPage() {
  const [tab, setTab] = useState('Todas')
  const rows = requests.filter(r => tab === 'Todas' || (tab === 'Por asignar' ? ['pending_assignment', 'payment_approved'].includes(r.status) : r.status === 'pending_payment'))
  return <><Header title="Solicitudes" description="De la primera consulta a un profesional asignado, sin perder de vista lo urgente." action={<ActionLink primary href="/admin/matching">Abrir matching <ArrowUpRight size={16} /></ActionLink>} /><Metrics items={[{ label: 'Solicitudes', value: requests.length, detail: 'En la muestra actual', icon: <ClipboardList /> }, { label: 'Por asignar', value: 2, detail: 'Requieren revisar candidatos' }, { label: 'Pendiente de pago', value: 1, detail: 'Antes de la asignación' }, { label: 'Prioritarias', value: 2, detail: 'Atención preferente' }]} /><Tabs options={['Todas', 'Por asignar', 'Pendiente de pago']} value={tab} onChange={setTab} /><RequestTable key={tab} rows={rows} /></>
}
export function JobsPage() {
  const [view, setView] = useState('Listado')
  return <><Header title="Trabajos" description="Seguí cada visita, su próximo paso y el estado del pago." /><Metrics items={[{ label: 'Trabajos', value: jobs.length, detail: 'Registrados en la muestra', icon: <Wrench /> }, { label: 'En camino', value: 1, detail: 'Visita confirmada' }, { label: 'Por confirmar', value: 1, detail: 'Esperando al cliente' }, { label: 'Completados', value: 1, detail: 'Servicio cerrado' }]} /><Tabs label="Vista de trabajos" options={['Listado', 'Agenda']} value={view} onChange={setView} />{view === 'Listado' ? <JobTable /> : <Panel title="Agenda de visitas" description="Fechas de los registros demostrativos; no es una agenda en tiempo real.">{jobs.map(job => <div className="adm-list-item" key={job.id}><div className="adm-inline"><CalendarDays size={22} /><div><strong>{job.scheduled} · {job.timeWindow}</strong><p>{job.customer} · {job.issueLabel}</p><small>{job.professional}</small></div></div><ActionLink href={`/admin/trabajos/${job.id}`}>Ver visita</ActionLink></div>)}</Panel>}</>
}
export function ProfessionalsPage() {
  return <><Header title="Profesionales" description="Una red confiable empieza con perfiles completos y señales claras de desempeño." section="Personas" action={<ActionLink primary href="/admin/profesionales/invitaciones">Invitar profesional</ActionLink>} /><Metrics items={[{ label: 'Profesionales', value: professionals.length, detail: 'Perfiles registrados', icon: <Users /> }, { label: 'Aprobados', value: 2, detail: 'Habilitados para recibir trabajos' }, { label: 'En revisión', value: 1, detail: 'Documentación por validar' }, { label: 'Rating promedio', value: '4,5', detail: 'De los cuatro perfiles' }]} /><DataTable title="Profesionales" rows={professionals} search={r => [r.id, r.name, r.email, r.zone, r.specialty]} filters={[{ label: 'Estado', value: r => r.status }, { label: 'Zona', value: r => r.zone }]} columns={[
    { key: 'name', label: 'Profesional', render: r => <Person name={r.name} detail={r.specialty} /> }, { key: 'zone', label: 'Zona', render: r => <>{r.zone}<small>{r.nextAvailability}</small></> }, { key: 'score', label: 'Desempeño', render: r => <><strong>{r.score}/100</strong><small>{r.rating} / 5 · {r.jobsCompleted} trabajos</small></> }, { key: 'status', label: 'Estado', render: r => <Badge value={r.status} /> }, { key: 'mp', label: 'Mercado Pago', render: r => <Badge value={r.mercadoPago} /> }, { key: 'action', label: 'Acción', render: r => <ActionLink href={`/admin/profesionales/${r.id}`}>Ver perfil</ActionLink> }
  ]} /></>
}
export function PaymentsPage() {
  const total = payments.reduce((sum, row) => sum + row.amount, 0)
  return <><Header title="Pagos" description="Trazabilidad de cada cobro y distribución entre Lysto y el profesional." section="Finanzas" action={<ActionLink href="/admin/marketplace">Reglas del marketplace</ActionLink>} /><Metrics items={[{ label: 'Importe total', value: money(total), detail: 'Tres pagos demostrativos', icon: <CreditCard /> }, { label: 'Comisión Lysto', value: money(payments.reduce((s, p) => s + p.platformFee, 0)), detail: '18% de los importes' }, { label: 'Profesionales', value: money(payments.reduce((s, p) => s + p.professionalAmount, 0)), detail: 'Distribución calculada' }, { label: 'Pagos cobrados', value: 2, detail: 'Un pago aprobado' }]} /><DataTable title="Pagos" rows={payments} search={r => [r.id, r.jobId, r.customer, r.professional]} filters={[{ label: 'Estado', value: r => r.status }]} columns={[
    { key: 'id', label: 'Pago / trabajo', render: r => <><strong>{r.id.toUpperCase()}</strong><Link href={`/admin/trabajos/${r.jobId}`}>{r.jobId.toUpperCase()}</Link><small>{r.createdAt}</small></> }, { key: 'person', label: 'Cliente / profesional', render: r => <><strong>{r.customer}</strong><small>{r.professional}</small></> }, { key: 'amount', label: 'Total', render: r => money(r.amount) }, { key: 'fee', label: 'Comisión Lysto', render: r => money(r.platformFee) }, { key: 'pro', label: 'Profesional', render: r => money(r.professionalAmount) }, { key: 'status', label: 'Estado', render: r => <Badge value={r.status} /> }
  ]} /><Notice>Vista de consulta. No se ejecutan liquidaciones ni devoluciones desde este entorno.</Notice></>
}
export function CustomersPage() {
  return <><Header title="Clientes" description="Personas, solicitudes y equipos: el contexto completo para una mejor atención." section="Personas" action={<ActionLink href="/admin/equipos">Ver equipos</ActionLink>} /><Metrics items={[{ label: 'Clientes', value: customers.length, detail: 'Perfiles de demostración', icon: <Users /> }, { label: 'Servicios históricos', value: 11, detail: 'Totales declarados en las fichas' }, { label: 'Clientes frecuentes', value: 1, detail: 'Relación de largo plazo' }, { label: 'Requiere atención', value: 1, detail: 'Revisar antes de contactar' }]} /><DataTable title="Clientes" rows={customers} search={r => [r.id, r.name, r.email, r.phone, r.address]} filters={[{ label: 'Segmento', value: r => r.risk }]} columns={[
    { key: 'name', label: 'Cliente', render: r => <Person name={r.name} detail={r.email} /> }, { key: 'address', label: 'Domicilio', render: r => <>{r.address}<small>{r.phone}</small></> }, { key: 'jobs', label: 'Servicios', render: r => <><strong>{r.jobsCount}</strong><small>Último: {r.lastService}</small></> }, { key: 'risk', label: 'Segmento', render: r => <Badge value={r.risk} /> }, { key: 'action', label: 'Acción', render: r => <ActionLink href={`/admin/clientes/${r.id}`}>Ver ficha</ActionLink> }
  ]} /></>
}
export function EquipmentPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const current = equipment.find(item => item.id === selected)
  return <><Header title="Equipos" description="La historia técnica de cada aire acondicionado, en un solo lugar." section="Base técnica" /><Metrics items={[{ label: 'Equipos registrados', value: equipment.length, detail: 'Base demostrativa', icon: <Wrench /> }, { label: 'Marcas', value: 3, detail: 'Surrey, BGH y LG' }, { label: 'Con mantenimiento', value: 3, detail: 'Próxima fecha informada' }, { label: 'Intervenciones', value: 4, detail: 'Entradas de historial' }]} /><DataTable title="Equipos" rows={equipment} search={r => [r.id, r.nickname, r.customer, r.brand, r.model]} filters={[{ label: 'Marca', value: r => r.brand }]} columns={[
    { key: 'name', label: 'Equipo', render: r => <><strong>{r.nickname}</strong><small>{r.brand} · {r.model}</small></> }, { key: 'customer', label: 'Cliente', render: r => <Person name={r.customer} detail={r.address} /> }, { key: 'service', label: 'Última intervención', render: r => <>{r.lastDiagnosis}<small>{r.lastService}</small></> }, { key: 'next', label: 'Mantenimiento', render: r => <><strong>{r.nextMaintenance}</strong><small>Fecha recomendada</small></> }, { key: 'history', label: 'Acción', render: r => <Button aria-expanded={selected === r.id} onClick={() => { setSelected(r.id); setTimeout(() => document.getElementById('equipment-history')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0) }}>Ver historial</Button> }
  ]} />{current && <div id="equipment-history" className="adm-stack" style={{ scrollMarginTop: 88 }}><Panel title={`Historial · ${current.nickname}`} action={<Button onClick={() => setSelected(null)}>Cerrar</Button>}><Facts items={[["Equipo", `${current.brand} ${current.model}`], ["Cliente", current.customer]]} /><div className="adm-timeline" style={{ marginTop: 24 }}>{current.history.map(item => <div key={item.date}><small>{item.date}</small><strong>{item.title}</strong><p>{item.detail}</p></div>)}</div></Panel></div>}</>
}
