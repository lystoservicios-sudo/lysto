import { z } from 'zod'
import { emailJobLinks, notificationOrigin } from './email-links'

export { notificationOrigin } from './email-links'

const aggregateId = z.string().uuid()
const simpleContextSchema = z
  .object({
    eventType: z.enum([
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
    ]),
    aggregateId,
    audience: z.enum(['customer', 'professional', 'operations', 'finance', 'quality'])
  })
  .strict()
const invitationContextSchema = z
  .object({
    eventType: z.literal('professional.invited'),
    aggregateId,
    audience: z.literal('professional'),
    invitationToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/)
  })
  .strict()
const visitContextSchema = z
  .object({
    eventType: z.literal('visit.confirmed'),
    aggregateId,
    audience: z.literal('customer'),
    scheduleVersion: z.number().int().positive(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    timezone: z.literal('America/Argentina/Buenos_Aires'),
    serviceName: z.string().trim().min(1).max(160),
    professionalName: z.string().trim().min(1).max(160),
    addressLabel: z.string().trim().min(1).max(500)
  })
  .strict()
const reviewContextSchema = z
  .object({
    eventType: z.literal('review.requested'),
    aggregateId,
    audience: z.literal('customer')
  })
  .strict()

export const noticeContextSchema = z.union([
  invitationContextSchema,
  visitContextSchema,
  reviewContextSchema,
  simpleContextSchema
])
export type NoticeContext = z.infer<typeof noticeContextSchema>
export type RenderedNotice = {
  version: 'transactional-v1' | 'transactional-v2'
  subject: string
  text: string
  html: string
  url: string
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )

function formatVisitInstant(value: string, timezone: string, kind: 'date' | 'time') {
  const options: Intl.DateTimeFormatOptions =
    kind === 'date'
      ? { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric' }
      : { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }
  return new Intl.DateTimeFormat('es-AR', options).format(new Date(value)).replace(',', '')
}

function emailShell(preheader: string, content: string) {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a"><div style="margin:0 auto;max-width:600px;overflow:hidden;border:1px solid #dbeafe;border-radius:20px;background:#ffffff"><div style="background:#1d4ed8;padding:22px 28px;color:#ffffff;font-size:24px;font-weight:800">Lysto</div><div style="padding:28px">${content}</div></div></div>`
}

function button(label: string, href: string, secondary = false) {
  const colors = secondary
    ? 'background:#ffffff;color:#1d4ed8;border:1px solid #93c5fd'
    : 'background:#1d4ed8;color:#ffffff;border:1px solid #1d4ed8'
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 6px 6px 0;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:700;${colors}">${escapeHtml(label)}</a>`
}

/** The dispatcher supplies a database-derived context, never a caller's message. */
export function renderOutboxNotification(raw: unknown, baseUrl: string): RenderedNotice {
  const context = noticeContextSchema.parse(raw)
  const origin = notificationOrigin(baseUrl)
  const { eventType: event, aggregateId: id, audience } = context

  if (event === 'visit.confirmed') {
    const links = emailJobLinks(origin, id)
    const date = formatVisitInstant(context.startsAt, context.timezone, 'date')
    const start = formatVisitInstant(context.startsAt, context.timezone, 'time')
    const end = formatVisitInstant(context.endsAt, context.timezone, 'time')
    const facts = `${date} · ${start}–${end}`
    const subject = 'Tu visita con Lysto está confirmada'
    const text = `${subject}\n\nServicio: ${context.serviceName}\nFecha y horario: ${facts}\nDirección: ${context.addressLabel}\nProfesional: ${context.professionalName}\n\nVer servicio: ${links.detail}\nCómo llegar: ${links.directions}\nSolicitar reprogramación: ${links.reschedule}\nContactar desde Lysto: ${links.contact}\n\nUna reprogramación sólo queda confirmada cuando Lysto muestra la nueva fecha.`
    const html = emailShell(
      `${context.serviceName}: ${facts}`,
      `<h1 style="margin:0 0 10px;font-size:28px;line-height:1.2">${escapeHtml(subject)}</h1><p style="margin:0 0 22px;color:#475569">Tu profesional y el horario ya están confirmados.</p><div style="border-radius:16px;background:#eff6ff;padding:20px"><p style="margin:0 0 12px;font-size:20px;font-weight:800">${escapeHtml(facts)}</p><p style="margin:6px 0"><strong>Servicio:</strong> ${escapeHtml(context.serviceName)}</p><p style="margin:6px 0"><strong>Dirección:</strong> ${escapeHtml(context.addressLabel)}</p><p style="margin:6px 0"><strong>Profesional:</strong> ${escapeHtml(context.professionalName)}</p></div><div style="margin-top:20px">${button('Ver servicio', links.detail)}${button('Cómo llegar', links.directions, true)}${button('Solicitar reprogramación', links.reschedule, true)}${button('Contactar desde Lysto', links.contact, true)}</div><p style="margin:20px 0 0;color:#64748b;font-size:13px">Una reprogramación sólo queda confirmada cuando Lysto muestra la nueva fecha.</p>`
    )
    return { version: 'transactional-v2', subject, text, html, url: links.detail }
  }

  if (event === 'review.requested') {
    const links = emailJobLinks(origin, id)
    const subject = '¿Cómo salió tu servicio?'
    const body =
      'Tu opinión nos ayuda a cuidar la calidad. La calificación es opcional y no cambia el cierre ni el pago del servicio.'
    return {
      version: 'transactional-v2',
      subject,
      text: `${subject}\n\n${body}\n\nCalificar servicio: ${links.review}`,
      html: emailShell(
        subject,
        `<h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">${escapeHtml(subject)}</h1><p style="margin:0 0 20px;line-height:1.6;color:#334155">${escapeHtml(body)}</p>${button('Calificar servicio', links.review)}`
      ),
      url: links.review
    }
  }

  let subject: string, body: string, path: string
  const allow = (...allowed: NoticeContext['audience'][]) => {
    if (!allowed.includes(audience)) throw new Error('invalid_notification_audience')
  }
  if (event === 'professional.invited') {
    allow('professional')
    subject = 'Terminá de crear tu cuenta profesional en Lysto'
    body =
      'Te invitamos a trabajar con Lysto. Creá tu contraseña y completá tu perfil profesional desde el botón. Si no esperabas esta invitación, podés ignorar este correo.'
    path = `/pro/onboarding/${context.invitationToken}`
    const url = new URL(path, origin).href
    return {
      version: 'transactional-v1', subject, url,
      text: `${body}\n\nTerminar de crear mi cuenta: ${url}`,
      html: emailShell(subject, `<p>${escapeHtml(body)}</p><p>${button('Terminar de crear mi cuenta', url)}</p>`)
    }
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
  const url = new URL(path, origin).href
  return {
    version: 'transactional-v1',
    subject,
    text: `${body}\n\n${url}`,
    html: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(url)}">Abrir Lysto</a></p>`,
    url
  }
}
