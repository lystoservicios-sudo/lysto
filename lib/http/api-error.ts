import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

const errors = {
  location_selection_required: {
    status: 400,
    message: 'Elegí la provincia y seleccioná una dirección de la lista.'
  },
  professional_invitation_exists: {
    status: 409,
    message: 'Ya existe una invitación para este correo. Revisá su expediente; para repetir el envío, usá Reenviar invitación.'
  },
  professional_account_exists: {
    status: 409,
    message: 'Este correo ya tiene una cuenta. Si es de cliente, usá otro correo para la cuenta de técnico. Si ya es técnico, revisá su expediente.'
  },
  equipment_required: { status: 400, message: 'Seleccioná un equipo vigente del cliente antes de enviar o confirmar el servicio. El técnico lo necesita para registrar el diagnóstico y el cierre.' },
  professional_unavailable: { status: 409, message: 'El técnico no está disponible para ese servicio y horario. Elegí otro profesional u otra fecha; conservamos los datos de la solicitud.' },
  payment_account_required: { status: 400, message: 'El técnico debe conectar su cuenta de cobro antes de enviar esta solicitud.' },
  administrative_replacement_required: { status: 409, message: 'Este servicio tiene precio y comisión personalizados. Resolvé el cobro anterior y creá una nueva solicitud desde administración para cambiar el profesional.' },
  address_has_home: {
    status: 409,
    message: 'Esta dirección está vinculada a un hogar. Archivá ese hogar antes de quitarla.'
  },
  last_owner: {
    status: 409,
    message:
      'Necesitás otro owner con cuenta activa y autenticador verificado antes de retirar este permiso.'
  },
  unauthorized: { status: 401, message: 'Iniciá sesión para continuar.' },
  forbidden: { status: 403, message: 'Tu cuenta no tiene permiso para esta operación.' },
  mfa_required: { status: 403, message: 'Verificá tu autenticador en Seguridad para continuar.' },
  not_found: { status: 404, message: 'No encontramos un recurso disponible para tu cuenta.' },
  invalid_input: { status: 400, message: 'Revisá los datos de la operación.' },
  conflict: {
    status: 409,
    message: 'Los datos cambiaron. Recargá la información antes de volver a guardar.'
  },
  upload_expired: {
    status: 410,
    message: 'La subida venció. Volvé a guardar la foto para iniciar un nuevo intento.'
  },
  feature_unavailable: { status: 503, message: 'Esta operación todavía no está habilitada.' },
  session_unavailable: {
    status: 503,
    message: 'No pudimos verificar tu acceso. Intentá nuevamente.'
  },
  service_unavailable: {
    status: 503,
    message: 'No pudimos completar la operación. Intentá nuevamente.'
  }
} as const

export type ApiErrorCode = keyof typeof errors
export class ApiError extends Error {
  readonly status: number
  constructor(readonly code: ApiErrorCode) {
    super(code)
    this.name = 'ApiError'
    this.status = errors[code].status
  }
}

export function privateResponse<T extends Response>(response: T): T {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

export function privateJson<T>(body: T, init?: ResponseInit) {
  return privateResponse(NextResponse.json(body, init))
}

export function apiErrorResponse(error: unknown) {
  const known =
    error instanceof ApiError
      ? error
      : new ApiError(
          error instanceof ZodError || error instanceof SyntaxError
            ? 'invalid_input'
            : 'service_unavailable'
        )
  return privateJson(
    { error: errors[known.code].message, code: known.code },
    { status: known.status }
  )
}
