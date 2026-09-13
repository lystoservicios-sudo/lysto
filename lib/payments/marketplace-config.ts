import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export function marketplaceConfig() {
  const clientId = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  const encryptionKey = process.env.MERCADOPAGO_ENCRYPTION_KEY
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const mode = process.env.MERCADOPAGO_MODE
  if (process.env.PAYMENTS_PROVIDER !== 'mercadopago_split' || !clientId || !clientSecret || !webhookSecret || !encryptionKey || !origin || !process.env.MERCADOPAGO_DATABASE_URL || !['test','live'].includes(mode ?? '')) throw new Error('payments_not_configured')
  const parsed = new URL(origin)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/') throw new Error('payments_https_required')
  if (Buffer.from(encryptionKey, 'base64').length !== 32) throw new Error('payments_not_configured')
  return { clientId, clientSecret, webhookSecret, encryptionKey, origin, liveMode: mode === 'live', redirectUri: `${origin}/api/mercadopago/oauth/callback` }
}
export function oauthBinding(state: string, userId: string, professionalId: string, key: string) {
  return createHmac('sha256', key).update(JSON.stringify([state,userId,professionalId])).digest('hex')
}
export function checkOAuthBinding(actual: string | undefined, expected: string) {
  return Boolean(actual && /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex')))
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  // Mutation routes require the browser's Origin; webhooks use signatures instead.
  if (!origin || origin !== new URL(request.url).origin) throw new Error('payment_forbidden')
}
export function paymentError(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  const messages: Record<string,string> = {
    payments_not_configured: 'Los pagos todavía no están configurados para este ambiente.',
    payments_https_required: 'Los pagos requieren un dominio HTTPS configurado.',
    unauthorized: 'Iniciá sesión para continuar.', forbidden: 'Tu cuenta no tiene permiso para esta operación.',
    payment_forbidden: 'No tenés acceso a este pago.', seller_not_linked: 'El profesional debe vincular su cuenta de Mercado Pago.',
    professional_acceptance_required: 'El profesional debe aceptar el trabajo antes del pago.',
    accepted_quote_required: 'Primero debe aceptarse un presupuesto revisado.', accepted_extra_required: 'El cliente debe aceptar el adicional antes de pagarlo.',
    checkout_identity_changed: 'El destinatario o el presupuesto cambió. Operaciones debe revisar el pago.',
    checkout_busy: 'El pago se está preparando. Volvé a consultar en unos segundos.',
    checkout_pending: 'Mercado Pago está procesando el pago. Esperá la confirmación antes de intentar otro.',
    payment_mode_mismatch: 'La cuenta de Mercado Pago no corresponde al ambiente de pruebas o producción configurado.',
    checkout_expired: 'El enlace venció. Operaciones debe revisar y renovar el pago.',
    checkout_review: 'Este pago requiere revisión. No vuelvas a pagar hasta que se resuelva.',
    oauth_invalid: 'La vinculación venció o no corresponde a esta sesión. Volvé a iniciarla.',
    seller_has_payments: 'Hay pagos asociados a esta cuenta. Operaciones debe revisarlos antes de desconectarla.',
  }
  const known = code in messages
  return NextResponse.json({ error: error instanceof ZodError ? 'Revisá los datos de la operación.' : known ? messages[code] : 'No se pudo completar la operación con Mercado Pago. Volvé a consultar el estado antes de reintentar.', code: known ? code : 'payment_unavailable' },
    { status: code === 'unauthorized' ? 401 : ['forbidden','payment_forbidden','oauth_invalid'].includes(code) ? 403 : code.includes('configured') || code.includes('https_required') ? 503 : code === 'checkout_busy' ? 409 : 400 })
}
