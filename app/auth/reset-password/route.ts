import { createServerSupabaseClient } from '@/lib/supabase/server'
import { passwordRecoveryPage, passwordRecoveryFormPage, accountRedirect, accountResponse, checkAccountOrigin, validAccountToken } from '@/lib/auth/account-response'
import { validRecoveryPassword } from '@/lib/auth/account-lifecycle'
import { createRecoveryContinuation, readRecoveryContinuation } from '@/lib/auth/recovery-continuation'
import { readTrustedRole } from '@/lib/auth/session-routing'

export async function POST(request: Request) {
  const json = request.headers.get('accept')?.includes('application/json') === true
  const failure = (message: string, status: number) => json
    ? accountResponse(Response.json({ message }, { status }))
    : passwordRecoveryPage(message, status)
  if (!checkAccountOrigin(request)) return failure('Origen no permitido.', 403)
  try {
    const form = await request.formData()
    const text = (key: string) => typeof form.get(key) === 'string' ? form.get(key) as string : ''
    const token = text('token_hash'), password = text('password'), continuation = text('continuation')
    const validPassword = validRecoveryPassword(password, text('repeatPassword'))
    const invalidPassword = 'Revisá el enlace y las contraseñas. Deben coincidir y tener entre 6 y 12 caracteres.'
    if (!continuation && (!validAccountToken(token) || !validPassword)) return failure(invalidPassword, 400)
    const client = await createServerSupabaseClient()
    const expired = () => failure('El enlace venció o ya fue utilizado. Solicitá otro desde Recuperar acceso.', 400)
    const grant = continuation ? readRecoveryContinuation(continuation) : null
    if (continuation && !grant) return expired()
    const verified = grant
      ? await client.auth.getUser()
      : await client.auth.verifyOtp({ token_hash: token, type: 'recovery' })
    if (verified.error || !verified.data.user) return expired()
    const user = verified.data.user
    async function sessionId() {
      const claims = await client.auth.getClaims()
      if (claims.error || claims.data?.claims.sub !== user.id || typeof claims.data.claims.session_id !== 'string')
        throw new Error('Recovery session unavailable')
      return claims.data.claims.session_id
    }
    if (grant && (grant.userId !== user.id || grant.sessionId !== await sessionId())) return expired()
    const passwordReady = await client.rpc('professional_password_change_ready')
    if (passwordReady.error) {
      await client.auth.signOut({ scope: 'local' })
      return failure('No pudimos verificar si tu cuenta está lista para cambiar la contraseña. Intentá nuevamente.', 503)
    }
    if (passwordReady.data !== true) {
      await client.auth.signOut({ scope: 'local' })
      return failure('Primero completá el alta técnica con tu clave provisoria. Después vas a poder cambiar la contraseña.', 403)
    }
    let nextContinuation = continuation
    async function retry(message: string, status: number, factors: Array<{ id: string; name: string }> = []) {
      nextContinuation ||= createRecoveryContinuation(user.id, await sessionId())
      return json
        ? accountResponse(Response.json({ message, continuation: nextContinuation, factors }, { status }))
        : passwordRecoveryFormPage(nextContinuation, factors, message, status)
    }
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assurance.error || !assurance.data) throw new Error('MFA assurance unavailable')
    if (assurance.data.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') {
      const listed = await client.auth.mfa.listFactors()
      if (listed.error || !listed.data) throw new Error('MFA factors unavailable')
      const factors = listed.data.totp.filter(factor => factor.status === 'verified')
        .map(factor => ({ id: factor.id, name: factor.friendly_name || 'Autenticador' }))
      if (!factors.length) return failure('Para recuperar esta cuenta necesitás tu método de verificación. Contactá al equipo de soporte.', 403)
      if (!validPassword) return retry(invalidPassword, 400, factors)
      if (!text('code')) return retry('Ingresá el código de tu autenticador para cambiar la contraseña.', 200, factors)
      if (!/^\d{6}$/.test(text('code')) || !factors.some(factor => factor.id === text('factorId')))
        return retry('Ingresá los seis dígitos que muestra tu autenticador.', 400, factors)
      const challenge = await client.auth.mfa.challengeAndVerify({ factorId: text('factorId'), code: text('code') })
      if (challenge.error || !challenge.data)
        return retry('No pudimos verificar el código. Revisá tu autenticador e intentá nuevamente.', 400, factors)
    }
    if (!validPassword) return retry(invalidPassword, 400)
    const updated = await client.auth.updateUser({ password })
    if (updated.error) {
      if (updated.error.code === 'same_password') return retry('Elegí una contraseña diferente de la que usabas antes.', 400)
      if (updated.error.code === 'weak_password') return retry('La contraseña no cumple los requisitos de seguridad. Elegí una más segura.', 400)
      await client.auth.signOut({ scope: 'local' })
      return failure('No pudimos cambiar la contraseña. Solicitá otro enlace e intentá nuevamente.', 400)
    }
    const role = readTrustedRole(user.app_metadata)
    const destination = role === 'professional' || role === 'admin' ? '/equipo/login?reset=success' : '/login?reset=success'
    const signedOut = await client.auth.signOut({ scope: 'global' })
    if (signedOut.error) {
      const message = 'La contraseña cambió, pero no pudimos cerrar todas las sesiones. Ingresá y cerrá las sesiones desde tu cuenta.'
      return json ? failure(message, 503) : passwordRecoveryPage(message, 503, 'login')
    }
    return json ? accountResponse(Response.json({ redirectTo: destination })) : accountRedirect(destination)
  } catch {
    return failure('No pudimos completar la recuperación. Solicitá otro enlace e intentá nuevamente.', 503)
  }
}
