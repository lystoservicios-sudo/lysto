import { z } from 'zod'

const events = [
  'professional.invited',
  'professional.application.submitted',
  'professional.approved',
  'professional.rejected',
  'professional.suspended',
  'quote.ready',
  'request.created',
  'request.cancelled',
  'job.assigned',
  'job.confirmed',
  'job.technician_on_way',
  'job.arrived',
  'job.completed_pending_customer_confirmation',
  'job.completed',
  'payment.approved',
  'payment.failed',
  'payment.refunded',
  'support.opened'
] as const
export const noticeContextSchema = z
  .object({
    eventType: z.enum(events),
    aggregateId: z.string().uuid(),
    audience: z.enum(['customer', 'professional', 'operations', 'finance', 'quality']),
    invitationToken: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .optional()
  })
  .strict()
export type NoticeContext = z.infer<typeof noticeContextSchema>
export type RenderedNotice = {
  version: 'transactional-v1'
  subject: string
  text: string
  html: string
  url: string
}

export function notificationOrigin(value: string): string {
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))
  )
    throw new Error('invalid_notification_origin')
  return url.origin
}
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )

/** The dispatcher supplies a database-derived context, never a caller's message. */
export function renderOutboxNotification(raw: unknown, baseUrl: string): RenderedNotice {
  const context = noticeContextSchema.parse(raw)
  const origin = notificationOrigin(baseUrl)
  const { eventType: event, aggregateId: id, audience } = context
  let subject: string, body: string, path: string
  const allow = (...allowed: NoticeContext['audience'][]) => {
    if (!allowed.includes(audience)) throw new Error('invalid_notification_audience')
  }
  if (event === 'professional.invited') {
    allow('professional')
    if (!context.invitationToken) throw new Error('invitation_token_required')
    subject = 'Tu invitación a Lysto'
    body =
      'Te invitamos a iniciar tu postulación profesional. Abrí el enlace para consultar los pasos y verificar tu cuenta.'
    path = `/pro/onboarding/${context.invitationToken}`
  } else if (event === 'professional.application.submitted') {
    allow('operations')
    subject = 'Postulación profesional para revisar'
    body =
      'Hay una postulación presentada. Revisá el expediente y sus documentos desde tu cuenta de operaciones.'
    path = `/admin/profesionales/${id}`
  } else if (event.startsWith('professional.')) {
    allow('professional', 'operations')
    const titles = {
      'professional.approved': 'Revisión de tu perfil aprobada',
      'professional.rejected': 'Tu postulación necesita correcciones',
      'professional.suspended': 'Revisión operativa de un perfil profesional'
    }
    subject = titles[event as keyof typeof titles]
    body =
      'Hay una actualización en la revisión profesional. Consultá el estado y los próximos pasos en la cuenta.'
    path = audience === 'operations' ? `/admin/profesionales/${id}` : '/pro/onboarding'
  } else if (event === 'quote.ready') {
    allow('customer', 'operations')
    subject = 'Tenés un presupuesto para revisar'
    body =
      'Revisá el alcance, las condiciones y la vigencia antes de aceptar. La aceptación no realiza un cobro ni confirma la disponibilidad de un profesional.'
    path = audience === 'customer' ? '/app/presupuestos' : '/admin/calculadora'
  } else if (event.startsWith('request.')) {
    allow('customer', 'operations')
    subject = event === 'request.cancelled' ? 'Solicitud cancelada' : 'Solicitud registrada'
    body =
      'Consultá el estado y los próximos pasos de la solicitud. Una franja preferida no equivale a una visita confirmada.'
    path =
      audience === 'customer' ? `/app/solicitudes/${id}` : `/admin/calculadora/solicitudes/${id}`
  } else if (event.startsWith('job.')) {
    allow('customer', 'professional', 'operations')
    const titles: Record<string, string> = {
      'job.assigned': 'Novedad en la asignación del servicio',
      'job.confirmed': 'Profesional confirmado',
      'job.technician_on_way': 'El profesional está en camino',
      'job.arrived': 'El profesional registró su llegada',
      'job.completed_pending_customer_confirmation': 'El servicio espera tu conformidad',
      'job.completed': 'Servicio cerrado'
    }
    subject = titles[event]
    body =
      'Hay una actualización del trabajo. Consultá los detalles y las acciones disponibles en tu cuenta.'
    path =
      audience === 'customer'
        ? `/app/trabajos/${id}`
        : audience === 'professional'
          ? `/pro/trabajos/${id}`
          : `/admin/calculadora/trabajos/${id}`
  } else if (event.startsWith('payment.')) {
    allow('customer', 'finance')
    subject =
      event === 'payment.approved'
        ? 'Pago aprobado'
        : event === 'payment.refunded'
          ? 'Actualización de una devolución'
          : 'Revisá el estado del pago'
    body =
      'Hay una actualización en el registro del pago. Consultá el estado y los importes confirmados en tu cuenta.'
    path = audience === 'customer' ? '/app/pagos' : '/admin/pagos'
  } else {
    allow('customer', 'professional', 'operations', 'quality')
    subject = 'Reclamo registrado para revisión'
    body =
      'Consultá el seguimiento y los próximos pasos. El registro del reclamo no determina su resolución ni la cobertura de garantía.'
    path =
      audience === 'customer'
        ? '/app/garantias'
        : audience === 'professional'
          ? '/pro/soporte'
          : '/admin/reclamos'
  }
  if (event !== 'professional.invited' && context.invitationToken)
    throw new Error('unexpected_invitation_token')
  const url = new URL(path, origin).href
  return {
    version: 'transactional-v1',
    subject,
    text: `${body}\n\n${url}`,
    html: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(url)}">Abrir Lysto</a></p>`,
    url
  }
}
