import { createServerSupabaseClient } from '@/lib/supabase/server'
import { bootstrapVerifiedCustomer } from '@/lib/auth/account-server'
import {
  accountRedirect,
  checkAccountOrigin,
  confirmationPage,
  validAccountToken
} from '@/lib/auth/account-response'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token_hash') ?? ''
  return validAccountToken(token)
    ? confirmationPage(token)
    : confirmationPage('', 'El enlace no es válido. Solicitá uno nuevo desde el registro.', 400)
}
export async function POST(request: Request) {
  if (!checkAccountOrigin(request))
    return confirmationPage('', 'No pudimos validar el origen de la solicitud.', 403)
  try {
    const form = await request.formData()
    const token = form.get('token_hash')
    if (typeof token !== 'string' || !validAccountToken(token))
      return confirmationPage('', 'El enlace no es válido.', 400)
    const client = await createServerSupabaseClient()
    const { data, error } = await client.auth.verifyOtp({ token_hash: token, type: 'email' })
    if (error || !data.user)
      return confirmationPage(
        '',
        'El enlace venció o ya fue utilizado. Solicitá uno nuevo desde el registro.',
        400
      )
    // This editable hint chooses a bounded page; it grants no domain authority.
    if (data.user.user_metadata?.professional_onboarding === true)
      return accountRedirect('/pro/onboarding')
    if (data.user.app_metadata.app_role !== 'customer') return accountRedirect('/login')
    return accountRedirect(
      (await bootstrapVerifiedCustomer(client, data.user)) === 'ready'
        ? '/app'
        : '/completar-cuenta'
    )
  } catch {
    return confirmationPage(
      '',
      'El correo pudo haberse confirmado, pero no pudimos preparar tu cuenta. Iniciá sesión para reintentar.',
      503
    )
  }
}
