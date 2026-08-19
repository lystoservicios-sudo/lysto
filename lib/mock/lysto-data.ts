import type { JobStatus, MaintenanceOption, PaymentStatus, ProfessionalStatus, RequestStatus, ServiceIssueSlug, UrgencyLevel } from '../domain/types.ts'

export type Metric = {
  label: string
  value: string
  helper: string
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
}

export type CustomerRecord = {
  id: string
  name: string
  email: string
  phone: string
  address: string
  equipmentCount: number
  jobsCount: number
  lastService: string
  risk: 'normal' | 'attention' | 'vip'
}

export type ProfessionalRecord = {
  id: string
  name: string
  email: string
  phone: string
  status: ProfessionalStatus
  zone: string
  rating: number
  jobsCompleted: number
  acceptanceRate: number
  toolsScore: number
  hasLicense: boolean
  mobility: string
  nextAvailability: string
  specialty: string
  score: number
  tools: string[]
  hasMobility: boolean
  mercadoPago: 'not_connected' | 'connected' | 'pending'
}

export type ServiceRequestRecord = {
  id: string
  customer: string
  phone: string
  issue: ServiceIssueSlug
  issueLabel: string
  status: RequestStatus
  urgency: UrgencyLevel
  selectedOption: UrgencyLevel
  address: string
  property: string
  timeWindow: string
  createdAt: string
  diagnosis: string
  price: number
  amount: number
  mediaCount: number
  assignedProfessional?: string
}

export type JobRecord = {
  id: string
  requestId: string
  customer: string
  professional: string
  status: JobStatus
  address: string
  scheduled: string
  scheduledDate: string
  timeWindow: string
  issueLabel: string
  amount: number
  paymentStatus: PaymentStatus
  equipment: string
  nextStep: string
  nextAction: string
}

export type EquipmentRecord = {
  id: string
  nickname: string
  customer: string
  address: string
  type: string
  brand: string
  model: string
  lastDiagnosis: string
  lastService: string
  nextMaintenance: string
  maintenanceOption: MaintenanceOption
  history: Array<{ date: string; title: string; detail: string }>
}

export type PaymentRecord = {
  id: string
  jobId: string
  customer: string
  professional: string
  amount: number
  platformFee: number
  professionalAmount: number
  status: PaymentStatus
  provider: 'mercadopago'
  createdAt: string
}

export type AuditRecord = {
  id: string
  actor: string
  action: string
  entity: string
  createdAt: string
  date: string
  severity: 'info' | 'warning' | 'critical'
}

export const customerMetrics: Metric[] = [
  { label: 'Trabajo activo', value: '1', helper: 'Técnico en camino', tone: 'blue' },
  { label: 'Equipos registrados', value: '2', helper: 'Living y dormitorio', tone: 'green' },
  { label: 'Próximo mantenimiento', value: '27 días', helper: 'Limpieza de filtros', tone: 'amber' },
  { label: 'Garantías vigentes', value: '1', helper: 'Hasta 19/09/2026', tone: 'slate' }
]

export const adminMetrics: Metric[] = [
  { label: 'Solicitudes nuevas', value: '18', helper: '6 prioridad', tone: 'blue' },
  { label: 'Trabajos hoy', value: '11', helper: '4 en curso', tone: 'green' },
  { label: 'Pagos aprobados', value: '$1.240.000', helper: 'Comisión estimada $223.200', tone: 'slate' },
  { label: 'Alertas calidad', value: '3', helper: '1 garantía abierta', tone: 'red' }
]

export const professionalMetrics: Metric[] = [
  { label: 'Agenda hoy', value: '3', helper: '2 confirmados, 1 prioridad', tone: 'blue' },
  { label: 'Calificación', value: '4.86', helper: 'Últimos 30 trabajos', tone: 'green' },
  { label: 'Aceptación', value: '92%', helper: 'Muy buena', tone: 'slate' },
  { label: 'Pagos pendientes', value: '$184.500', helper: '2 liquidaciones', tone: 'amber' }
]

export const customers: CustomerRecord[] = [
  { id: 'cus_001', name: 'Lucía Fernández', email: 'lucia@example.com', phone: '+54 9 11 3333-1111', address: 'Av. Corrientes 1234, CABA', equipmentCount: 2, jobsCount: 4, lastService: '19/08/2026', risk: 'vip' },
  { id: 'cus_002', name: 'Mariano Díaz', email: 'mariano@example.com', phone: '+54 9 11 3333-2222', address: 'Soler 2450, Palermo', equipmentCount: 1, jobsCount: 1, lastService: '12/08/2026', risk: 'normal' },
  { id: 'cus_003', name: 'Carla Núñez', email: 'carla@example.com', phone: '+54 9 11 3333-3333', address: 'Juramento 1800, Belgrano', equipmentCount: 3, jobsCount: 6, lastService: '02/08/2026', risk: 'attention' }
]

export const professionals: ProfessionalRecord[] = [
  { id: 'pro_001', name: 'Martín Gómez', email: 'martin@lysto.pro', phone: '+54 9 11 5555-1010', status: 'approved', zone: 'CABA Norte', rating: 4.9, jobsCompleted: 84, acceptanceRate: 0.94, toolsScore: 9, hasLicense: true, mobility: 'Camioneta', nextAvailability: 'Hoy 16:00', specialty: 'Split e inverter residencial', score: 93, tools: ['Bomba de vacío','Manifold R410A/R32','Multímetro','Detector de fugas'], hasMobility: true, mercadoPago: 'connected' },
  { id: 'pro_002', name: 'Diego Pérez', email: 'diego@lysto.pro', phone: '+54 9 11 5555-2020', status: 'under_review', zone: 'CABA Centro', rating: 4.7, jobsCompleted: 22, acceptanceRate: 0.88, toolsScore: 8, hasLicense: true, mobility: 'Auto', nextAvailability: 'Mañana 10:00', specialty: 'Mantenimiento y reparación residencial', score: 81, tools: ['Multímetro','Hidrolavadora','Escalera'], hasMobility: true, mercadoPago: 'pending' },
  { id: 'pro_003', name: 'Lucas Ramírez', email: 'lucas@lysto.pro', phone: '+54 9 11 5555-3030', status: 'approved', zone: 'CABA Sur', rating: 4.6, jobsCompleted: 57, acceptanceRate: 0.91, toolsScore: 7, hasLicense: true, mobility: 'Moto', nextAvailability: 'Hoy 18:00', specialty: 'Instalación y reinstalación', score: 87, tools: ['Rotomartillo','Pestañadora','Balanza digital'], hasMobility: true, mercadoPago: 'connected' },
  { id: 'pro_004', name: 'Sergio López', email: 'sergio@lysto.pro', phone: '+54 9 11 5555-4040', status: 'suspended', zone: 'AMBA Norte', rating: 3.9, jobsCompleted: 18, acceptanceRate: 0.61, toolsScore: 6, hasLicense: false, mobility: 'Auto', nextAvailability: 'Suspendido', specialty: 'Reparación general', score: 40, tools: ['Multímetro'], hasMobility: true, mercadoPago: 'not_connected' }
]

export const serviceRequests: ServiceRequestRecord[] = [
  { id: 'req_1001', customer: 'Lucía Fernández', phone: '+54 9 11 3333-1111', issue: 'no_enfria', issueLabel: 'No enfría', status: 'pending_assignment', urgency: 'priority', selectedOption: 'priority', address: 'Av. Corrientes 1234, CABA', property: 'Departamento con ascensor', timeWindow: '16:00 – 18:00', createdAt: '19/08/2026 08:14', diagnosis: 'Carga de gas baja o filtros obstruidos', price: 43750, amount: 43750, mediaCount: 3, assignedProfessional: 'Martín Gómez' },
  { id: 'req_1002', customer: 'Mariano Díaz', phone: '+54 9 11 3333-2222', issue: 'pierde_agua', issueLabel: 'Pierde agua', status: 'payment_approved', urgency: 'flexible', selectedOption: 'flexible', address: 'Soler 2450, Palermo', property: 'Casa', timeWindow: '10:00 – 12:00', createdAt: '19/08/2026 09:02', diagnosis: 'Drenaje obstruido o bandeja sucia', price: 35000, amount: 35000, mediaCount: 1 },
  { id: 'req_1003', customer: 'Carla Núñez', phone: '+54 9 11 3333-3333', issue: 'instalacion', issueLabel: 'Instalación', status: 'pending_payment', urgency: 'priority', selectedOption: 'priority', address: 'Juramento 1800, Belgrano', property: 'Departamento sin estacionamiento', timeWindow: '14:00 – 16:00', createdAt: '18/08/2026 18:21', diagnosis: 'Relevar distancia, ménsulas y acceso', price: 68750, amount: 68750, mediaCount: 0 }
]

export const jobs: JobRecord[] = [
  { id: 'job_7001', requestId: 'req_1001', customer: 'Lucía Fernández', professional: 'Martín Gómez', status: 'technician_on_way', address: 'Av. Corrientes 1234, CABA', scheduled: '19/08/2026', scheduledDate: '19/08/2026', timeWindow: '16:00 – 18:00', issueLabel: 'No enfría', amount: 43750, paymentStatus: 'approved', equipment: 'Split living Surrey inverter', nextStep: 'Confirmar llegada al domicilio', nextAction: 'Confirmar llegada al domicilio' },
  { id: 'job_7002', requestId: 'req_0992', customer: 'Carla Núñez', professional: 'Lucas Ramírez', status: 'completed_pending_customer_confirmation', address: 'Juramento 1800, Belgrano', scheduled: '18/08/2026', scheduledDate: '18/08/2026', timeWindow: '14:00 – 16:00', issueLabel: 'Mantenimiento', amount: 35000, paymentStatus: 'captured', equipment: 'Aire dormitorio BGH', nextStep: 'Esperando review del cliente', nextAction: 'Esperando review del cliente' },
  { id: 'job_7003', requestId: 'req_0985', customer: 'Mariano Díaz', professional: 'Martín Gómez', status: 'completed', address: 'Soler 2450, Palermo', scheduled: '12/08/2026', scheduledDate: '12/08/2026', timeWindow: '10:00 – 12:00', issueLabel: 'Pierde agua', amount: 37500, paymentStatus: 'captured', equipment: 'Split habitación LG', nextStep: 'Comprobante generado', nextAction: 'Comprobante generado' }
]

export const equipment: EquipmentRecord[] = [
  { id: 'eq_001', nickname: 'Aire living', customer: 'Lucía Fernández', address: 'Av. Corrientes 1234, CABA', type: 'Split inverter', brand: 'Surrey', model: '553AIQ1201F', lastDiagnosis: 'Carga de gas baja', lastService: '19/08/2026', nextMaintenance: '19/02/2027', maintenanceOption: 'deep_cleaning_6_months', history: [{ date: '19/08/2026', title: 'Diagnóstico por falta de frío', detail: 'Se revisó presión, filtros y unidad exterior.' }, { date: '20/07/2026', title: 'Limpieza preventiva', detail: 'Limpieza de filtros y serpentina.' }] },
  { id: 'eq_002', nickname: 'Aire dormitorio', customer: 'Lucía Fernández', address: 'Av. Corrientes 1234, CABA', type: 'Split on/off', brand: 'BGH', model: 'BS35WCCR', lastDiagnosis: 'Limpieza preventiva', lastService: '20/07/2026', nextMaintenance: '20/10/2026', maintenanceOption: 'filters_90_days', history: [{ date: '20/07/2026', title: 'Mantenimiento preventivo', detail: 'Filtros y drenaje revisados.' }] },
  { id: 'eq_003', nickname: 'Aire habitación', customer: 'Mariano Díaz', address: 'Soler 2450, Palermo', type: 'Split', brand: 'LG', model: 'S4-W12JA3AA', lastDiagnosis: 'Drenaje obstruido', lastService: '12/08/2026', nextMaintenance: '12/11/2026', maintenanceOption: 'filters_90_days', history: [{ date: '12/08/2026', title: 'Reparación de pérdida de agua', detail: 'Drenaje destapado y bandeja limpia.' }] }
]

export const payments: PaymentRecord[] = [
  { id: 'pay_001', jobId: 'job_7001', customer: 'Lucía Fernández', professional: 'Martín Gómez', amount: 43750, platformFee: 7875, professionalAmount: 35875, status: 'approved', provider: 'mercadopago', createdAt: '19/08/2026 08:19' },
  { id: 'pay_002', jobId: 'job_7002', customer: 'Carla Núñez', professional: 'Lucas Ramírez', amount: 35000, platformFee: 6300, professionalAmount: 28700, status: 'captured', provider: 'mercadopago', createdAt: '18/08/2026 13:48' },
  { id: 'pay_003', jobId: 'job_7003', customer: 'Mariano Díaz', professional: 'Martín Gómez', amount: 37500, platformFee: 6750, professionalAmount: 30750, status: 'captured', provider: 'mercadopago', createdAt: '12/08/2026 09:11' }
]

export const auditLogs: AuditRecord[] = [
  { id: 'aud_001', actor: 'Admin Operaciones', action: 'Asignó profesional Martín Gómez', entity: 'job_7001', createdAt: '19/08/2026 08:26', date: '19/08/2026 08:26', severity: 'info' },
  { id: 'aud_002', actor: 'Mercado Pago webhook', action: 'Pago aprobado', entity: 'pay_001', createdAt: '19/08/2026 08:19', date: '19/08/2026 08:19', severity: 'info' },
  { id: 'aud_003', actor: 'Admin Calidad', action: 'Abrió garantía por reincidencia', entity: 'job_6991', createdAt: '18/08/2026 19:40', date: '18/08/2026 19:40', severity: 'warning' }
]

export const qualityItems = [
  { title: 'Garantía abierta', detail: 'Cliente reportó que volvió a perder agua a las 48 hs.', status: 'En revisión' },
  { title: 'Review baja', detail: 'Puntualidad reportada como mala en Palermo.', status: 'Acción correctiva' },
  { title: 'Profesional destacado', detail: 'Martín Gómez supera 4.9 y 90% aceptación.', status: 'Premiar' }
]

export const priceRules = [
  { label: 'Visita diagnóstico', value: '$35.000', helper: 'Base flexible CABA' },
  { label: 'Instalación', value: '+$20.000', helper: 'Incluye relevar materiales' },
  { label: 'Acceso en altura', value: '+$10.000', helper: 'Requiere equipo y validación' },
  { label: 'Prioridad', value: 'x1.25', helper: 'SLA y asignación preferente' },
  { label: 'Comisión Lysto', value: '18%', helper: 'Configurable por servicio' }
]

export const diagnosisRules = [
  { issue: 'No enfría', topCause: 'Carga de gas baja', level: 'Alto', checklist: 'Medir presión, revisar filtros, unidad exterior y consumo.' },
  { issue: 'Pierde agua', topCause: 'Drenaje obstruido', level: 'Alto', checklist: 'Destapar drenaje, revisar bandeja y pendiente.' },
  { issue: 'Hace ruido', topCause: 'Turbina o soporte flojo', level: 'Medio', checklist: 'Inspección visual, motor, rodamientos y unidad exterior.' },
  { issue: 'No enciende', topCause: 'Problema eléctrico', level: 'Alto', checklist: 'Tensión, térmica, placa, capacitor y bornera.' }
]

export const jobStatusLabels: Record<JobStatus, string> = {
  pending_assignment: 'Pendiente de asignación',
  pending_professional_acceptance: 'Esperando aceptación',
  confirmed: 'Confirmado',
  technician_on_way: 'Técnico en camino',
  arrived: 'Llegó al domicilio',
  onsite_diagnosis: 'Diagnóstico en curso',
  waiting_customer_approval: 'Esperando aprobación',
  in_progress: 'Trabajo en curso',
  completed_pending_customer_confirmation: 'Finalizado por técnico',
  completed: 'Completado',
  cancelled_by_customer: 'Cancelado por cliente',
  cancelled_by_professional: 'Cancelado por profesional',
  cancelled_by_admin: 'Cancelado por admin',
  disputed: 'En disputa',
  warranty_claim: 'Garantía'
}

export function money(value: number) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}


export type LystoMetric = Metric
export type LystoRequest = ServiceRequestRecord
export type LystoProfessional = ProfessionalRecord
export type LystoJob = JobRecord
export type LystoEquipment = EquipmentRecord

export const requests = serviceRequests
export const auditEvents = auditLogs
