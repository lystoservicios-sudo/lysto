import { createServerSupabaseClient } from '@/lib/supabase/server'
import { accountResponse, accountRedirect, checkAccountOrigin, validAccountToken } from '@/lib/auth/account-response'
import { validRecoveryPassword } from '@/lib/auth/account-lifecycle'

export async function POST(request: Request) {
  if (!checkAccountOrigin(request)) return accountResponse(new Response('Origen no permitido.',{status:403}))
  try {
    const form = await request.formData()
    const token = form.get('token_hash'), password = form.get('password'), confirmation = form.get('repeatPassword')
    if (typeof token !== 'string' || !validAccountToken(token) || typeof password !== 'string' || typeof confirmation !== 'string' || !validRecoveryPassword(password,confirmation)) return accountResponse(new Response('Revisá el enlace y las contraseñas. Deben coincidir y tener entre 12 y 128 caracteres.',{status:400}))
    const client = await createServerSupabaseClient()
    const { data, error } = await client.auth.verifyOtp({ token_hash:token,type:'recovery' })
    if (error || !data.user) return accountResponse(new Response('El enlace venció o ya fue utilizado. Solicitá otro desde Recuperar acceso.',{status:400}))
    const updated = await client.auth.updateUser({password})
    if (updated.error) {
      await client.auth.signOut({scope:'local'})
      return accountResponse(new Response('No pudimos cambiar la contraseña. Solicitá otro enlace e intentá nuevamente.',{status:400}))
    }
    const signedOut = await client.auth.signOut({scope:'global'})
    if (signedOut.error) return accountResponse(new Response('La contraseña cambió, pero no pudimos cerrar todas las sesiones. Ingresá y cerrá las sesiones desde tu cuenta.',{status:503}))
    return accountRedirect('/login?reset=success')
  } catch { return accountResponse(new Response('No pudimos completar la recuperación. Solicitá otro enlace e intentá nuevamente.',{status:503})) }
}
