'use client'

export async function assetRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) {
    if (response.status === 409)
      throw new Error('Los datos cambiaron. Recargá la información antes de volver a guardar.')
    if (response.status === 401) throw new Error('Tu sesión terminó. Volvé a iniciar sesión.')
    if (response.status === 400) throw new Error('Revisá los datos ingresados.')
    throw new Error('No pudimos completar la operación. Intentá nuevamente.')
  }
  return response.json() as Promise<T>
}

export type AssetPage<T> = { items: T[]; total: number; nextCursor: string | null }
export function assetError(error: unknown) {
  return error instanceof Error && error.name === 'Error'
    ? error.message
    : 'No pudimos completar la operación. Intentá nuevamente.'
}
