import type { JobStatus, PaymentStatus, ProfessionalStatus, RequestStatus, UserRole } from '../domain/types.ts'

export type NotificationChannel = 'in_app' | 'email' | 'whatsapp_manual' | 'push_future'
export type NotificationAudience = UserRole | 'operations'

export type NotificationPlan = {
  event: string
  audiences: NotificationAudience[]
  channels: NotificationChannel[]
  title: string
  body: string
  dedupeKey: string
}

export function planRequestStatusNotification(requestId: string, status: RequestStatus): NotificationPlan | null {
  const base = { channels: ['in_app', 'email'] as NotificationChannel[], dedupeKey: `request:${requestId}:${status}` }
  switch (status) {
    case 'payment_approved':
      return { ...base, event: 'request.payment_approved', audiences: ['customer', 'operations'], title: 'Pago aprobado', body: 'Tu solicitud ya está confirmada y vamos a buscar el mejor profesional.' }
    case 'pending_assignment':
    case 'matching':
      return { ...base, event: 'request.matching', audiences: ['customer', 'operations'], title: 'Buscando profesional', body: 'Estamos verificando disponibilidad, zona, matrícula y experiencia.' }
    case 'assigned':
      return { ...base, event: 'request.assigned', audiences: ['customer', 'professional', 'operations'], title: 'Técnico asignado', body: 'Ya tenés un profesional verificado asignado para tu servicio.' }
    case 'cancelled':
      return { ...base, event: 'request.cancelled', audiences: ['customer', 'operations'], title: 'Solicitud cancelada', body: 'La solicitud fue cancelada. Revisá el detalle para ver próximos pasos.' }
    default:
      return null
  }
}

export function planJobStatusNotification(jobId: string, status: JobStatus): NotificationPlan | null {
  const base = { channels: ['in_app', 'email'] as NotificationChannel[], dedupeKey: `job:${jobId}:${status}` }
  switch (status) {
    case 'confirmed':
      return { ...base, event: 'job.confirmed', audiences: ['customer', 'professional', 'operations'], title: 'Trabajo confirmado', body: 'El profesional aceptó el servicio y ya quedó confirmado.' }
    case 'technician_on_way':
      return { ...base, event: 'job.technician_on_way', audiences: ['customer', 'operations'], title: 'El técnico está en camino', body: 'El profesional marcó que salió hacia tu domicilio.' }
    case 'arrived':
      return { ...base, event: 'job.arrived', audiences: ['customer', 'operations'], title: 'El técnico llegó', body: 'El profesional llegó al domicilio y puede iniciar el diagnóstico.' }
    case 'waiting_customer_approval':
      return { ...base, event: 'job.waiting_customer_approval', audiences: ['customer', 'professional', 'operations'], title: 'Presupuesto final pendiente', body: 'Hay un presupuesto final esperando aprobación.' }
    case 'completed_pending_customer_confirmation':
      return { ...base, event: 'job.completed_pending_customer_confirmation', audiences: ['customer', 'operations'], title: 'Trabajo terminado', body: 'Confirmá el cierre y dejá tu calificación del servicio.' }
    case 'completed':
      return { ...base, event: 'job.completed', audiences: ['customer', 'professional', 'operations'], title: 'Servicio cerrado', body: 'El trabajo quedó cerrado con comprobante e historial técnico.' }
    case 'disputed':
    case 'warranty_claim':
      return { ...base, event: `job.${status}`, audiences: ['operations'], channels: ['in_app', 'email', 'whatsapp_manual'], title: 'Revisión operativa requerida', body: 'Este trabajo requiere intervención de calidad/soporte.' }
    default:
      return null
  }
}

export function planPaymentNotification(paymentId: string, status: PaymentStatus): NotificationPlan | null {
  const base = { channels: ['in_app', 'email'] as NotificationChannel[], dedupeKey: `payment:${paymentId}:${status}` }
  if (status === 'approved') return { ...base, event: 'payment.approved', audiences: ['customer', 'operations'], title: 'Pago recibido', body: 'El pago fue aprobado correctamente.' }
  if (status === 'rejected' || status === 'failed') return { ...base, event: 'payment.failed', audiences: ['customer', 'operations'], title: 'No pudimos procesar el pago', body: 'Intentá nuevamente o elegí otro medio de pago.' }
  if (status === 'refunded' || status === 'partially_refunded') return { ...base, event: 'payment.refunded', audiences: ['customer', 'operations'], title: 'Devolución registrada', body: 'Se registró una devolución sobre el pago.' }
  return null
}

export function planProfessionalStatusNotification(professionalId: string, status: ProfessionalStatus): NotificationPlan | null {
  const base = { channels: ['in_app', 'email'] as NotificationChannel[], dedupeKey: `professional:${professionalId}:${status}` }
  if (status === 'approved') return { ...base, event: 'professional.approved', audiences: ['professional', 'operations'], title: 'Perfil aprobado', body: 'Tu perfil ya puede recibir trabajos de Lysto.' }
  if (status === 'rejected') return { ...base, event: 'professional.rejected', audiences: ['professional', 'operations'], title: 'Perfil observado', body: 'Necesitamos revisar o corregir información de tu postulación.' }
  if (status === 'suspended') return { ...base, event: 'professional.suspended', audiences: ['professional', 'operations'], title: 'Perfil suspendido', body: 'Tu perfil no recibirá trabajos hasta nueva revisión.' }
  return null
}
