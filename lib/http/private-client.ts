'use client'

/** Keeps transaction rejection distinct from a lost/ambiguous network response. */
export class PrivateRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message) }
}

export async function privateRequest<T>(path: string, method = 'GET', body?: unknown, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string' ? payload.code : undefined
    if (response.status === 409) {
      if (code === 'professional_invitation_exists')
        throw new PrivateRequestError('Ya existe una invitación para este correo. Revisá su expediente; para repetir el envío, usá Reenviar invitación.', 409, code)
      if (code === 'professional_account_exists')
        throw new PrivateRequestError('Este correo ya tiene una cuenta. Si es de cliente, usá otro correo para la cuenta de técnico. Si ya es técnico, revisá su expediente.', 409, code)
      if (code === 'address_has_home') throw new PrivateRequestError('Esta dirección está vinculada a un hogar. Archivá ese hogar antes de quitarla.', 409, code)
      if (code === 'last_owner')
        throw new PrivateRequestError(
          'Necesitás otro owner con cuenta activa y autenticador verificado antes de retirar este permiso.', 409, code
        )
    }
    if (response.status === 409)
      throw new PrivateRequestError('Los datos cambiaron. Recargá la información antes de volver a guardar.', 409, code)
    if (response.status === 401) throw new PrivateRequestError('Tu sesión terminó. Volvé a iniciar sesión.', 401, code)
    if (response.status === 400 && code === 'location_selection_required')
      throw new PrivateRequestError('Elegí la provincia y seleccioná una dirección de la lista.', 400, code)
    if (response.status === 400) throw new PrivateRequestError('Revisá los datos ingresados.', 400, code)
    throw new PrivateRequestError('No pudimos completar la operación. Intentá nuevamente.', response.status, code)
  }
  return response.json() as Promise<T>
}

export function requestError(error: unknown) {
  return error instanceof Error && error.name === 'Error'
    ? error.message
    : 'No pudimos completar la operación. Intentá nuevamente.'
}
