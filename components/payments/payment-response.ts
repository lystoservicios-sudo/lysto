export async function paymentResponse(response: Response) {
  let body
  try { body = await response.json() } catch { throw new Error('No pudimos consultar los pagos. Actualizá la página o contactá a Lysto.') }
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo completar la operación. Consultá el estado antes de reintentar.')
  return body
}
