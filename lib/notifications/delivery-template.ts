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

/** Invitation credentials are rendered for synchronous delivery only; never seal this in the outbox. */
export function renderProfessionalTemporaryInvitation(
  input: { email: string; invitationToken: string; temporaryPassword: string },
  baseUrl: string
): RenderedNotice {
  const email = z.string().email().max(254).parse(input.email)
  const invitationToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(input.invitationToken)
  const temporaryPassword = z.string().regex(/^\d{7}$/).parse(input.temporaryPassword)
  const origin = notificationOrigin(baseUrl)
  const login = new URL('/equipo/login', origin)
  login.searchParams.set('next', `/pro/onboarding/${invitationToken}`)
  const url = login.href
  const subject = 'Tu acceso para completar tu cuenta profesional en Lysto'
  const body = 'Te invitamos a sumarte a Lysto como profesional. Ingresá con estos datos para completar tu perfil técnico.'
  return {
    version: 'transactional-v1',
    subject,
    url,
    text: `${subject}\n\n${body}\n\nEmail: ${email}\nContraseña provisoria: ${temporaryPassword}\n\nIngresar y completar mi perfil: ${url}\n\nLa contraseña es provisoria. No la compartas.`,
    html: emailShell({
      origin,
      family: 'professionals',
      preheader: 'Tus datos de acceso para comenzar el alta profesional.',
      eyebrow: 'Comunidad profesional',
      title: subject,
      intro: body,
      content: detailPanel([
        ['Email', email],
        ['Contraseña provisoria', temporaryPassword]
      ]),
      primary: { label: 'Ingresar y completar mi perfil', href: url },
      note: 'La contraseña es provisoria. No la compartas y cambiala al completar tu cuenta.',
      reason: 'Recibís este correo porque Lysto te invitó a completar una cuenta profesional.'
    })
  }
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

type EmailFamily = 'visits' | 'requests' | 'payments' | 'security' | 'support' | 'professionals'

const familyAsset: Record<EmailFamily, string> = {
  visits: 'email-visits.jpg',
  requests: 'email-requests.jpg',
  payments: 'email-payments.jpg',
  security: 'email-security.jpg',
  support: 'email-support.jpg',
  professionals: 'email-professionals.jpg'
}

function button(label: string, href: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="border-radius:14px;background:#1d4ed8;text-align:center"><a href="${escapeHtml(href)}" style="display:block;padding:15px 22px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;line-height:1.25">${escapeHtml(label)}</a></td></tr></table>`
}

function detailPanel(rows: Array<[string, string]>) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius:16px;background:#eef5ed">${rows
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:${index === 0 ? '20px' : '16px 20px'};${index ? 'border-top:1px solid #d9e5d7;' : ''}"><div style="margin:0 0 4px;color:#5d687d;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">${escapeHtml(label)}</div><div style="color:#101e43;font-size:17px;font-weight:750;line-height:1.45">${escapeHtml(value)}</div></td></tr>`
    )
    .join('')}</table>`
}

function emailShell(input: {
  origin: string
  family: EmailFamily
  preheader: string
  eyebrow: string
  title: string
  intro: string
  content?: string
  primary: { label: string; href: string }
  secondary?: Array<{ label: string; href: string }>
  note?: string
  reason: string
}) {
  const logo = new URL('/images/email/lysto-logo.png', input.origin).href
  const illustration = new URL(`/images/email/${familyAsset[input.family]}`, input.origin).href
  const secondary = input.secondary?.length
    ? `<div style="padding-top:18px;text-align:center">${input.secondary
        .map(
          (action) =>
            `<a href="${escapeHtml(action.href)}" style="display:inline-block;margin:4px 10px;color:#1554f0;font-size:14px;font-weight:750;text-decoration:underline;text-underline-offset:3px">${escapeHtml(action.label)}</a>`
        )
        .join('')}</div>`
    : ''
  const note = input.note
    ? `<div style="margin-top:22px;padding:16px 18px;border-radius:14px;background:#f4f7f2;color:#426b50;font-size:13px;line-height:1.6">${escapeHtml(input.note)}</div>`
    : ''
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;margin:0;background:#f7f7f2;font-family:Arial,'Helvetica Neue',sans-serif;color:#101e43"><tr><td align="center" style="padding:24px 12px"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;max-width:640px;overflow:hidden;border:1px solid #e4e9e1;border-radius:22px;background:#fffefa"><tr><td style="padding:26px 34px 20px"><img src="${escapeHtml(logo)}" width="196" alt="Lysto" style="display:block;width:196px;max-width:52%;height:auto;border:0"></td></tr><tr><td style="padding:0 20px"><img src="${escapeHtml(illustration)}" width="600" alt="" role="presentation" style="display:block;width:100%;height:auto;border:0;border-radius:18px"></td></tr><tr><td style="padding:30px 34px 34px"><div style="margin:0 0 10px;color:#426b50;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(input.eyebrow)}</div><h1 style="margin:0;color:#101e43;font-size:32px;line-height:1.12;letter-spacing:-.02em">${escapeHtml(input.title)}</h1><p style="margin:14px 0 24px;color:#5d687d;font-size:16px;line-height:1.65">${escapeHtml(input.intro)}</p>${input.content ? `<div style="margin-bottom:24px">${input.content}</div>` : ''}${button(input.primary.label, input.primary.href)}${secondary}${note}</td></tr><tr><td style="padding:22px 34px;border-top:1px solid #e4e9e1;background:#eef5ed;color:#5d687d;font-size:12px;line-height:1.6;text-align:center"><strong style="color:#426b50">Lysto cuida tu hogar.</strong><br>${escapeHtml(input.reason)}</td></tr></table></td></tr></table>`
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
    const html = emailShell({
      origin,
      family: 'visits',
      preheader: `${context.serviceName}: ${facts}`,
      eyebrow: 'Visita confirmada',
      title: subject,
      intro: 'Ya coordinamos el horario y el profesional para tu servicio.',
      content: detailPanel([
        ['Fecha y horario', facts],
        ['Servicio', context.serviceName],
        ['Tu profesional', context.professionalName],
        ['Dirección del servicio', context.addressLabel]
      ]),
      primary: { label: 'Ver mi servicio', href: links.detail },
      secondary: [
        { label: 'Cómo llegar', href: links.directions },
        { label: 'Necesito reprogramar', href: links.reschedule },
        { label: 'Contactar desde Lysto', href: links.contact }
      ],
      note: 'Una reprogramación sólo queda confirmada cuando Lysto muestra la nueva fecha.',
      reason: 'Recibís este correo porque tenés un servicio activo en Lysto.'
    })
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
      html: emailShell({
        origin,
        family: 'visits',
        preheader: subject,
        eyebrow: 'Tu experiencia',
        title: subject,
        intro: body,
        primary: { label: 'Calificar servicio', href: links.review },
        note: 'La calificación es opcional y no modifica el cierre ni el pago del servicio.',
        reason: 'Recibís este correo porque finalizaste un servicio con Lysto.'
      }),
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
      html: emailShell({
        origin,
        family: 'professionals',
        preheader: subject,
        eyebrow: 'Comunidad profesional',
        title: subject,
        intro: body,
        primary: { label: 'Terminar de crear mi cuenta', href: url },
        reason: 'Recibís este correo porque Lysto te invitó a crear una cuenta profesional.'
      })
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
  const family: EmailFamily = event.startsWith('professional.')
    ? 'professionals'
    : event.startsWith('payment.')
      ? 'payments'
      : event === 'support.opened'
        ? 'support'
        : event.startsWith('job.')
          ? 'visits'
          : 'requests'
  const eyebrow = event.startsWith('professional.')
    ? 'Cuenta profesional'
    : event.startsWith('payment.')
      ? 'Movimiento de pago'
      : event === 'support.opened'
        ? 'Acompañamiento Lysto'
        : event.startsWith('job.')
          ? 'Tu servicio'
          : 'Tu solicitud'
  return {
    version: 'transactional-v1',
    subject,
    text: `${body}\n\n${url}`,
    html: emailShell({
      origin,
      family,
      preheader: subject,
      eyebrow,
      title: subject,
      intro: body,
      primary: { label: 'Abrir Lysto', href: url },
      reason: 'Recibís este correo porque hay una actualización en tu cuenta de Lysto.'
    }),
    url
  }
}
