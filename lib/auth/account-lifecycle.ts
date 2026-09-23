import { z } from 'zod'

export type RegistrationPolicy = { termsVersion: string; privacyVersion: string; termsUrl: string; privacyUrl: string; testOnly: boolean }
export type RegistrationInput = { email: string; password: string; repeatPassword: string; firstName: string; lastName: string; phone: string; accepted: boolean; termsVersion: string; privacyVersion: string }
export const GENERIC_REGISTRATION_MESSAGE = 'Si el correo puede registrarse, recibirás un mensaje para continuar. Si ya tenés cuenta, podés ingresar o recuperar tu contraseña.'
export const GENERIC_RECOVERY_MESSAGE = 'Si existe una cuenta habilitada con ese correo, recibirás instrucciones para recuperar el acceso.'
const registrationPasswordSchema = z.string().min(6).max(12)
const recoveryPasswordSchema = z.string().min(12).max(128)
const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254), password: registrationPasswordSchema,
  repeatPassword: z.string(), firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100), phone: z.string().trim().max(40).refine(value => value.replace(/\D/g, '').length >= 8),
  accepted: z.literal(true), termsVersion: z.string(), privacyVersion: z.string()
})
export function validateRegistration(input: RegistrationInput, policy: RegistrationPolicy | null): { ok: boolean; message?: string; data?: RegistrationInput } {
  if (!policy) return { ok: false, message: 'El registro todavía no está habilitado. Intentá más tarde.' }
  const parsed = registrationSchema.safeParse(input)
  if (!parsed.success || input.password !== input.repeatPassword) return { ok: false, message: 'Revisá tus datos, repetí la contraseña (6 a 12 caracteres) y aceptá los documentos.' }
  if (input.termsVersion !== policy.termsVersion || input.privacyVersion !== policy.privacyVersion) return { ok: false, message: 'Los documentos cambiaron. Recargá la página y revisalos antes de continuar.' }
  return { ok: true, data: parsed.data }
}
export function authOrigin(configured: string | undefined): string {
  if (!configured) throw new Error('Application origin is not configured')
  const url = new URL(configured)
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Application origin is invalid')
  return url.origin
}
export function isAllowedAuthOrigin(origin: string | null, configured: string | undefined): boolean {
  try { return origin !== null && origin === authOrigin(configured) } catch { return false }
}
export function validRecoveryPassword(password: string, confirmation: string): boolean { return recoveryPasswordSchema.safeParse(password).success && password === confirmation }
export type AccountResult = { status: 'idle' | 'error' | 'success'; message: string }
export async function registerCustomer(input: RegistrationInput, policy: RegistrationPolicy | null, gateway: { signUp: (input: RegistrationInput) => Promise<{ error: { code?: string } | null }> }): Promise<AccountResult> {
  const validation = validateRegistration(input, policy)
  if (!validation.ok || !validation.data) return { status: 'error', message: validation.message! }
  try {
    const { error } = await gateway.signUp(validation.data)
    if (error && !['user_already_exists', 'email_exists', 'over_email_send_rate_limit'].includes(error.code ?? '')) return { status: 'error', message: 'No pudimos procesar la solicitud. Intentá nuevamente en unos minutos.' }
  } catch { return { status: 'error', message: 'No pudimos procesar la solicitud. Intentá nuevamente en unos minutos.' } }
  return { status: 'success', message: GENERIC_REGISTRATION_MESSAGE }
}
export async function recoverAccount(email: string, gateway: { reset: (email: string) => Promise<{ error: { code?: string } | null }> }): Promise<AccountResult> {
  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(email)
  if (!parsed.success) return { status: 'error', message: 'Ingresá un correo válido.' }
  // Provider errors must not turn this endpoint into an account-existence oracle.
  try { await gateway.reset(parsed.data) } catch { /* The same public response applies. */ }
  return { status: 'success', message: GENERIC_RECOVERY_MESSAGE }
}
