import { z } from 'zod'

export const customerFields = ['first_name', 'last_name', 'phone', 'street', 'number', 'city', 'province', 'property_type'] as const
export type CustomerField = typeof customerFields[number]
export type CustomerIdentity = { first_name?: string | null; last_name?: string | null; phone?: string | null }
export type CustomerAddress = { id?: string; street?: string | null; number?: string | null; city?: string | null; province?: string | null; property_type?: string | null }

const name = z.string().trim().min(1, 'Completá este dato.').max(100)
const fieldsSchema = z.object({
  first_name: name,
  last_name: name,
  phone: z.string().trim().max(40).refine((value) => value.replace(/\D/g, '').length >= 8, 'Ingresá un teléfono válido.'),
  street: z.string().trim().min(1).max(200),
  number: z.string().trim().min(1).max(30),
  city: name,
  province: name,
  property_type: z.enum(['house', 'apartment', 'commercial', 'office'])
})

export function safeCustomerNext(value?: string | null): string {
  if (!value || !/^\/app(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(value)) return '/app'
  return value
}

export function missingCustomerFields(profile: CustomerIdentity | null, address: CustomerAddress | null): CustomerField[] {
  const current = { ...profile, ...address }
  return customerFields.filter((key) => !fieldsSchema.shape[key].safeParse(current[key]).success)
}

export function customerDestination(context: { verified: boolean; profile: CustomerIdentity | null; address: CustomerAddress | null }, next?: string | null): string {
  if (!context.verified) return '/login?notice=confirm-email'
  const destination = safeCustomerNext(next)
  return missingCustomerFields(context.profile, context.address).length
    ? `/completar-perfil?next=${encodeURIComponent(destination)}`
    : destination
}

export const passwordSchema = z.string().min(6, 'Usá al menos 6 caracteres.').max(12, 'Usá hasta 12 caracteres.')
export function validateRegistration(input: { email: string; password: string; confirmPassword: string; firstName: string; lastName: string }) {
  return z.object({ email: z.string().trim().toLowerCase().email('Ingresá un email válido.'), password: passwordSchema, confirmPassword: z.string(), firstName: name, lastName: name })
    .refine((data) => data.password === data.confirmPassword, { message: 'Las contraseñas no coinciden.', path: ['confirmPassword'] }).safeParse(input)
}

export function validateProfileCompletion(profile: CustomerIdentity | null, address: CustomerAddress | null, formData: FormData) {
  const current = { ...profile, ...address }
  const missing = missingCustomerFields(profile, address)
  return fieldsSchema.safeParse(Object.fromEntries(customerFields.map((key) => [key, missing.includes(key) ? formData.get(key) : current[key]])))
}

export function textValue(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export function authNotice(value?: string) {
  const messages: Record<string, string> = {
    'confirm-email': 'Revisá tu email y confirmá tu cuenta para continuar.',
    'invalid-link': 'Este enlace venció o ya fue utilizado. Pedí uno nuevo e intentá nuevamente.',
    'oauth-error': 'No pudimos continuar con Google. Intentá nuevamente o usá tu email.',
    'unavailable': 'No pudimos conectarnos con Lysto. Intentá nuevamente en unos minutos.',
    'account-unavailable': 'No pudimos habilitar el acceso a tu cuenta. Contactanos para ayudarte.',
    'password-updated': 'Tu contraseña se actualizó. Ya podés iniciar sesión.'
  }
  return value ? messages[value] ?? '' : ''
}
