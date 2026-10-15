import { createServerSupabaseClient } from '@/lib/supabase/server'
import { passwordRecoveryPage, accountRedirect, checkAccountOrigin, validAccountToken } from '@/lib/auth/account-response'
import { validRecoveryPassword } from '@/lib/auth/account-lifecycle'

export async function POST(request: Request) {
  if (!checkAccountOrigin(request)) return passwordRecoveryPage('Origen no permitido.', 403)
  try {
    const form = await request.formData()
    const token = form.get('token_hash'), password = form.get('password'), confirmation = form.get('repeatPassword')
    if (typeof token !== 'string' || !validAccountToken(token) || typeof password !== 'string' || typeof confirmation !== 'string' || !validRecoveryPassword(password,confirmation)) return passwordRecoveryPage('Revisá el enlace y las contraseñas. Deben coincidir y tener entre 6 y 12 caracteres.', 400)
    const client = await createServerSupabaseClient()
    const { data, error } = await client.auth.verifyOtp({ token_hash:token,type:'recovery' })
    if (error || !data.user) return passwordRecoveryPage('El enlace venció o ya fue utilizado. Solicitá otro desde Recuperar acceso.', 400)
    const passwordReady = await client.rpc('professional_password_change_ready')
    if (passwordReady.error) {
      await client.auth.signOut({ scope: 'local' })
      return passwordRecoveryPage('No pudimos verificar si tu cuenta está lista para cambiar la contraseña. Intentá nuevamente.', 503)
    }
    if (passwordReady.data !== true) {
      await client.auth.signOut({ scope: 'local' })
      return passwordRecoveryPage('Primero completá el alta técnica con tu clave provisoria. Después vas a poder cambiar la contraseña.', 403)
    }
    const updated = await client.auth.updateUser({password})
    if (updated.error) {
      await client.auth.signOut({scope:'local'})
      return passwordRecoveryPage('No pudimos cambiar la contraseña. Solicitá otro enlace e intentá nuevamente.', 400)
    }
    const signedOut = await client.auth.signOut({scope:'global'})
    if (signedOut.error) return passwordRecoveryPage('La contraseña cambió, pero no pudimos cerrar todas las sesiones. Ingresá y cerrá las sesiones desde tu cuenta.', 503, 'login')
    return accountRedirect('/login?reset=success')
  } catch { return passwordRecoveryPage('No pudimos completar la recuperación. Solicitá otro enlace e intentá nuevamente.', 503) }
}
