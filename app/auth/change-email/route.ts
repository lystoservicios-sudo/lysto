import { createServerSupabaseClient } from '@/lib/supabase/server'
import { accountResponse, checkAccountOrigin, validAccountToken } from '@/lib/auth/account-response'

export const dynamic = 'force-dynamic'
function page(
  token: string,
  message = 'Confirmá este correo. Para terminar el cambio necesitás confirmar los enlaces del correo actual y del nuevo.',
  status = 200
) {
  const safeToken = validAccountToken(token) ? token : ''
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cambiar correo — Lysto</title></head><body><main><h1>Cambiar correo</h1><p>${message}</p>${safeToken ? `<form action="/auth/change-email" method="post"><input type="hidden" name="token_hash" value="${safeToken}"><button type="submit">Confirmar cambio de correo</button></form>` : '<a href="/app/perfil">Volver al perfil</a>'}</main></body></html>`
  const response = accountResponse(
    new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  )
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
  )
  return response
}
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token_hash') ?? ''
  return validAccountToken(token)
    ? page(token)
    : page('', 'El enlace no es válido. Solicitá un nuevo cambio desde tu perfil.', 400)
}
export async function POST(request: Request) {
  if (!checkAccountOrigin(request))
    return page('', 'No pudimos validar el origen de la solicitud.', 403)
  try {
    const token = (await request.formData()).get('token_hash')
    if (typeof token !== 'string' || !validAccountToken(token))
      return page('', 'El enlace no es válido.', 400)
    const client = await createServerSupabaseClient()
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'email_change' })
    if (error)
      return page(
        '',
        'El enlace venció o ya fue utilizado. Revisá tu perfil antes de solicitar otro cambio.',
        400
      )
    return page(
      '',
      'Confirmación registrada. Si todavía no confirmaste el otro correo, revisá ese buzón. El perfil muestra el correo vigente después de confirmar ambos enlaces.'
    )
  } catch {
    return page(
      '',
      'No pudimos completar la confirmación. Revisá tu perfil antes de reintentar.',
      503
    )
  }
}
