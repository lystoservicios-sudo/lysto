'use client'

import { useState } from 'react'
import { AirVent, ArrowRight, Camera, Check, ChevronDown, ClipboardCheck, LifeBuoy, MapPin } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusPill } from '@/components/business/status-pill'
import { InfoNotice } from '@/components/customer/info-notice'
import { MediaUploader } from '@/components/customer/media-uploader'
import { EquipmentThumbnail } from '@/components/customer/equipment-thumbnail'
import { jobStatusLabels } from '@/lib/domain/job-status-labels'
import { money, type EquipmentRecord, type JobRecord, type ServiceRequestRecord } from '@/lib/mock/lysto-data'
import type { JobStatus } from '@/lib/domain/types'
import { visitStage,visitStages } from './pro-model'
import { professionalEquipment,professionalJobs,professionalPayments } from '@/lib/mock/pro-scope'
import { DraftFeedback, ProFacts, ProPage, ProPanel, ProShortcut, useProDraft } from './pro-ui'

export function ProfessionalRequestDetail({ request }: { request: ServiceRequestRecord }) {
  const linkedJob = professionalJobs.find(job => job.requestId === request.id)
  const draft = useProDraft(`request:${request.id}`, { decision: '', reason: '' })
  return <ProPage title={request.issueLabel} description={`Solicitud ${request.id.replace('req_', '#')} · ${request.customer}`} back={{ href: '/pro/solicitudes', label: 'Solicitudes' }} action={<Badge tone={request.urgency === 'priority' ? 'amber' : 'blue'}>{request.urgency === 'priority' ? 'Atención prioritaria' : 'Horario flexible'}</Badge>}>
    <div className="pro-two-col"><div className="pro-stack"><ProPanel title="La visita de un vistazo"><ProFacts items={[{ label: 'Horario solicitado', value: request.timeWindow }, { label: 'Tipo de propiedad', value: request.property }, { label: linkedJob ? 'Dirección' : 'Zona de referencia', value: linkedJob ? request.address : request.address.split(',').slice(-1)[0] }, { label: 'Total del servicio', value: money(request.price) }]} /><p className="pro-muted mt-5">El total incluye comisión. El neto y la asignación definitiva requieren confirmación de Lysto.</p></ProPanel>
      <ProPanel title="Qué reporta el cliente"><div className="flex gap-4"><span className="pro-icon"><AirVent size={22} aria-hidden="true" /></span><div><h3 className="font-bold">{request.issueLabel}</h3><p className="pro-muted mt-1">Orientación inicial: {request.diagnosis}.</p></div></div><div className="flex gap-3 items-center mt-6 border-t border-slate-100 pt-5"><Camera size={20} className="text-slate-500 shrink-0" aria-hidden="true" /><p className="pro-muted">{request.mediaCount} archivo{request.mediaCount !== 1 ? 's' : ''} indicado{request.mediaCount !== 1 ? 's' : ''} en el registro. No hay archivos disponibles para visualizar en esta demo.</p></div></ProPanel>
      <InfoNotice title="Confirmá el diagnóstico en la visita" description="La información inicial es orientativa. Revisá las condiciones de acceso y no prometas una reparación antes de evaluar el equipo." />
    </div><ProPanel title={linkedJob ? 'Esta solicitud ya tiene trabajo' : 'Tu respuesta'} description={linkedJob ? 'Continuá desde la ficha de la visita.' : 'Prepará una respuesta. No se enviará en esta demo.'}>
      {linkedJob ? <ButtonLink className="w-full" href={`/pro/trabajos/${linkedJob.id}`}>Ir al trabajo<ArrowRight size={17} className="ml-2" aria-hidden="true" /></ButtonLink> : <form onSubmit={event => { event.preventDefault(); draft.save() }} className="pro-stack"><fieldset><legend className="text-sm font-semibold mb-2">¿Podrías realizar esta visita?</legend>{[['accept', 'Sí, tengo disponibilidad'], ['decline', 'No puedo en ese horario'], ['review', 'Necesito aclarar información']].map(([value, label]) => <label className="pro-checkbox" key={value}><input type="radio" name="decision" value={value} required checked={draft.values.decision === value} onChange={() => draft.setValues({ ...draft.values, decision: value })} />{label}</label>)}</fieldset><label className="pro-field">Comentario {draft.values.decision === 'accept' ? '(opcional)' : '(obligatorio)'}<Textarea value={draft.values.reason} required={draft.values.decision !== 'accept'} maxLength={1200} onChange={event => draft.setValues({ ...draft.values, reason: event.target.value })} placeholder="Explicá qué necesitás que revisemos." /></label><Button type="submit" disabled={!draft.values.decision}>Guardar respuesta de prueba</Button><DraftFeedback feedback={draft.feedback} /></form>}
      <p className="pro-muted mt-5">No se reserva el horario ni se notifica al cliente.</p>
    </ProPanel></div>
  </ProPage>
}

const nextVisitAction: Partial<Record<JobStatus, { label: string; status: JobStatus }>> = {
  confirmed: { label: 'Simular salida hacia la visita', status: 'technician_on_way' },
  technician_on_way: { label: 'Simular llegada', status: 'arrived' },
  arrived: { label: 'Simular inicio de diagnóstico', status: 'onsite_diagnosis' },
  onsite_diagnosis: { label: 'Simular envío de diagnóstico', status: 'waiting_customer_approval' }
}

export function ProfessionalJobDetail({ job }: { job: JobRecord }) {
  const [previewStatus, setPreviewStatus] = useState<JobStatus>(job.status)
  const [files, setFiles] = useState<File[]>([])
  const payment = professionalPayments.find(item => item.jobId === job.id)
  const items = professionalEquipment.filter(item => item.customer === job.customer)
  const draft = useProDraft(`job:${job.id}`, { diagnosis: '', work: '', parts: '', maintenance: '', reviewed: false as boolean, equipment: job.equipment, brand: '', model: '' })
  const stage = visitStage(previewStatus)
  const next = nextVisitAction[previewStatus]
  const closed = job.status === 'completed' || job.status.startsWith('cancelled')
  const needsDiagnosis = previewStatus === 'onsite_diagnosis' && !draft.values.diagnosis.trim()
  return <ProPage title={job.issueLabel} description={`Trabajo ${job.id.replace('job_', '#')} · ${job.customer}`} back={{ href: '/pro/trabajos', label: 'Mis trabajos' }} action={<StatusPill status={job.status} />}>
    <div className="pro-two-col"><div className="pro-stack">
      <ProPanel title="Tu visita" description={`${job.scheduledDate} · ${job.timeWindow}`}><p className="font-semibold flex gap-2 items-start"><MapPin size={20} className="text-blue-700 shrink-0" aria-hidden="true" />{job.address}</p><p className="pro-muted mt-2">{job.equipment}</p><div className="mt-5 flex flex-wrap gap-3"><ButtonLink href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" variant="secondary"><MapPin size={17} className="mr-2" aria-hidden="true" />Abrir mapa</ButtonLink><ButtonLink href="/pro/soporte" variant="ghost"><LifeBuoy size={17} className="mr-2" aria-hidden="true" />Necesito ayuda</ButtonLink></div></ProPanel>
      <ProPanel title={closed ? 'Recorrido del servicio' : 'Paso a paso'} description={previewStatus !== job.status ? 'Vista de prueba · El estado registrado no cambió.' : 'Primero la visita, después el diagnóstico y el cierre.'}>
        <ol className="pro-steps" aria-label="Etapas del trabajo">{visitStages.map((label, index) => <li key={label} data-done={index < stage} aria-current={index === stage ? 'step' : undefined}><span>{index < stage ? <Check size={16} aria-hidden="true" /> : index + 1}</span>{label}</li>)}</ol>
        <div className="mt-6 pt-5 border-t border-slate-100"><p className="font-semibold">{jobStatusLabels[previewStatus]}</p><p className="pro-muted mt-1">{previewStatus === 'waiting_customer_approval' ? 'La reparación requiere aprobación del cliente. Esta demo no puede aprobar en su nombre.' : closed ? 'Consultá los datos y el historial del equipo debajo.' : 'Registrá los detalles de la visita antes de continuar.'}</p></div>
      </ProPanel>
      {!closed && <ProPanel title="Notas de la visita" description="Borrador privado de esta pestaña. No se envía al cliente."><form className="pro-stack" onSubmit={event => { event.preventDefault(); draft.save() }}>
        <label className="pro-field">Diagnóstico presencial<Textarea value={draft.values.diagnosis} maxLength={3000} onChange={event => draft.setValues({ ...draft.values, diagnosis: event.target.value })} placeholder="Qué encontraste y cómo lo verificaste." /></label>
        <details className="pro-accordion"><summary><AirVent size={19} aria-hidden="true" />Identificación del equipo<ChevronDown size={18} aria-hidden="true" /></summary><div className="pro-form-grid">{(['equipment', 'brand', 'model'] as const).map((key, index) => <label className="pro-field" key={key}>{['Nombre del equipo', 'Marca', 'Modelo'][index]}<Input value={draft.values[key]} maxLength={100} onChange={event => draft.setValues({ ...draft.values, [key]: event.target.value })} /></label>)}</div></details>
        <details className="pro-accordion"><summary><ClipboardCheck size={19} aria-hidden="true" />Preparar el cierre<ChevronDown size={18} aria-hidden="true" /></summary><div className="pro-stack">{(['work', 'parts', 'maintenance'] as const).map((key, index) => <label className="pro-field" key={key}>{['Trabajo realizado', 'Repuestos utilizados', 'Mantenimiento recomendado'][index]}<Textarea value={draft.values[key]} maxLength={3000} onChange={event => draft.setValues({ ...draft.values, [key]: event.target.value })} /></label>)}<label className="pro-checkbox"><input type="checkbox" checked={draft.values.reviewed} onChange={event => draft.setValues({ ...draft.values, reviewed: event.target.checked })} />Revisé los datos del cierre</label></div></details>
        <details className="pro-accordion"><summary><Camera size={19} aria-hidden="true" />Fotos de la visita<ChevronDown size={18} aria-hidden="true" /></summary><div><p className="pro-muted mb-4">Sólo vista previa local. Las fotos no se suben ni se guardan con el borrador; se pierden al salir.</p><MediaUploader files={files} onFilesChange={setFiles} target={null} /></div></details>
        <Button type="submit" variant="secondary">Guardar borrador de visita</Button><DraftFeedback feedback={draft.feedback} />
      </form></ProPanel>}
      {closed && <InfoNotice tone="success" title="Servicio registrado" description="La ficha muestra el estado guardado en los datos demostrativos. No hay un comprobante descargable disponible en esta vista." />}
    </div><div className="pro-stack"><ProPanel title="Importes del servicio"><ProFacts items={[{ label: 'Total del cliente', value: money(job.amount) }, { label: 'Tu neto registrado', value: payment ? money(payment.professionalAmount) : 'Por confirmar' }, { label: 'Comisión', value: payment ? money(payment.platformFee) : 'Por confirmar' }, { label: 'Estado del pago', value: <StatusPill status={job.paymentStatus} /> }]} /><ButtonLink href="/pro/pagos" variant="secondary" className="w-full mt-6">Ver mis cobros</ButtonLink></ProPanel><ProPanel title="Equipos del cliente">{items.map(item => <ProShortcut key={item.id} href={`/pro/equipos/${item.id}`} title={item.nickname} description={`${item.brand} · ${item.model}`} icon={AirVent} />)}{!items.length && <p className="pro-muted">Todavía no hay equipos vinculados a este cliente.</p>}</ProPanel></div></div>
    {!closed && next && <div className="pro-action-bar"><div><p className="font-semibold text-sm">{needsDiagnosis ? 'Completá el diagnóstico para seguir' : 'Probá el siguiente paso'}</p><p className="pro-muted">Simulación local. No modifica el trabajo real.</p></div><Button disabled={needsDiagnosis} onClick={() => setPreviewStatus(next.status)}>{next.label}<ArrowRight size={18} className="ml-2" aria-hidden="true" /></Button></div>}
    {previewStatus === 'in_progress' && <InfoNotice title="Antes de finalizar" description="Completá las notas y el cierre. La finalización real y la generación del comprobante todavía no están conectadas." />}
  </ProPage>
}

export function ProfessionalEquipmentDetail({ item }: { item: EquipmentRecord }) {
  return <ProPage title={item.nickname} description={`${item.customer} · ${item.address}`} back={{ href: '/pro/trabajos', label: 'Mis trabajos' }}>
    <div className="pro-two-col"><div className="pro-stack"><ProPanel title="Ficha técnica"><div className="flex gap-4 items-center mb-6"><EquipmentThumbnail equipmentName={item.nickname} size="sm" /><div><h2 className="font-bold text-xl">{item.brand}</h2><p className="pro-muted">{item.model}</p></div></div><ProFacts items={[{ label: 'Tipo', value: item.type }, { label: 'Último servicio', value: item.lastService }, { label: 'Último diagnóstico', value: item.lastDiagnosis }, { label: 'Mantenimiento previsto', value: item.nextMaintenance }]} /></ProPanel><ProPanel title="Historial de servicios" description={`${item.history.length} intervención${item.history.length !== 1 ? 'es' : ''} registrada${item.history.length !== 1 ? 's' : ''}`}><ol className="space-y-6">{item.history.map((entry, index) => <li key={`${entry.date}-${index}`} className="flex gap-4"><span className="pro-icon"><WrenchIcon /></span><div><p className="pro-muted">{entry.date}</p><h3 className="font-semibold mt-1">{entry.title}</h3><p className="pro-muted mt-2">{entry.detail}</p></div></li>)}</ol></ProPanel></div><InfoNotice title="El historial te ayuda a diagnosticar" description="Usá los antecedentes como referencia y confirmá el estado actual durante la visita. No hay fotos del equipo disponibles en esta demo." /></div>
  </ProPage>
}

function WrenchIcon() { return <ClipboardCheck size={20} aria-hidden="true" /> }
