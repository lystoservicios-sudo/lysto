'use client'

export async function privateRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) {
    if (response.status === 409) {
      const body: unknown = await response.json().catch(() => null)
      if (body && typeof body === 'object' && 'code' in body && body.code === 'last_owner')
        throw new Error(
          'Necesitás otro owner con cuenta activa y autenticador verificado antes de retirar este permiso.'
        )
    }
    if (response.status === 409)
      throw new Error('Los datos cambiaron. Recargá la información antes de volver a guardar.')
    if (response.status === 401) throw new Error('Tu sesión terminó. Volvé a iniciar sesión.')
    if (response.status === 400) throw new Error('Revisá los datos ingresados.')
    throw new Error('No pudimos completar la operación. Intentá nuevamente.')
  }
  return response.json() as Promise<T>
}

export function requestError(error: unknown) {
  return error instanceof Error && error.name === 'Error'
    ? error.message
    : 'No pudimos completar la operación. Intentá nuevamente.'
}
