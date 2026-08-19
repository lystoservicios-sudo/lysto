import type { JobStatus, PaymentStatus, ProfessionalStatus, RequestStatus } from '../domain/types.ts'

export type NotificationAudience = 'customer' | 'professional' | 'admin'
export type NotificationTemplateInput = {
  audience: NotificationAudience
  event: string
  requestStatus?: RequestStatus
  jobStatus?: JobStatus
  paymentStatus?: PaymentStatus
  professionalStatus?: ProfessionalStatus
  professionalName?: string
  serviceLabel?: string
}

export function buildNotificationTemplate(input: NotificationTemplateInput): { title: string; body: string; channelPriority: Array<'in_app' | 'email' | 'whatsapp'> } {
  const service = input.serviceLabel ?? 'tu servicio'
  if (input.event === 'payment_approved') {
    return { title: 'Pago confirmado', body: `Ya confirmamos el pago de ${service}. Estamos asignando el mejor profesional.`, channelPriority: ['in_app', 'email', 'whatsapp'] }
  }
  if (input.event === 'professional_confirmed') {
    return { title: 'Técnico confirmado', body: `${input.professionalName ?? 'El profesional asignado'} aceptó el trabajo.`, channelPriority: ['in_app', 'whatsapp', 'email'] }
  }
  if (input.jobStatus === 'technician_on_way') {
    return { title: 'El técnico está en camino', body: 'El profesional marcó que salió hacia tu domicilio.', channelPriority: ['in_app', 'whatsapp'] }
  }
  if (input.jobStatus === 'completed_pending_customer_confirmation') {
    return { title: 'Servicio finalizado', body: 'Revisá el comprobante y confirmá cómo fue la experiencia.', channelPriority: ['in_app', 'email'] }
  }
  if (input.audience === 'admin') {
    return { title: 'Evento operativo', body: 'Hay una acción pendiente en el panel admin.', channelPriority: ['in_app'] }
  }
  return { title: 'Actualización Lysto', body: 'Hay una novedad en tu cuenta.', channelPriority: ['in_app'] }
}
