import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

const errors = {
  unauthorized: { status: 401, message: 'Iniciá sesión para continuar.' },
  forbidden: { status: 403, message: 'Tu cuenta no tiene permiso para esta operación.' },
  not_found: { status: 404, message: 'No encontramos un recurso disponible para tu cuenta.' },
  invalid_input: { status: 400, message: 'Revisá los datos de la operación.' },
  upload_expired: { status: 410, message: 'La subida venció. Volvé a guardar la foto para iniciar un nuevo intento.' },
  feature_unavailable: { status: 503, message: 'Esta operación todavía no está habilitada.' },
  session_unavailable: { status: 503, message: 'No pudimos verificar tu acceso. Intentá nuevamente.' },
  service_unavailable: { status: 503, message: 'No pudimos completar la operación. Intentá nuevamente.' }
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
  const known = error instanceof ApiError ? error : new ApiError(error instanceof ZodError || error instanceof SyntaxError ? 'invalid_input' : 'service_unavailable')
  return privateJson({ error: errors[known.code].message, code: known.code }, { status: known.status })
}
