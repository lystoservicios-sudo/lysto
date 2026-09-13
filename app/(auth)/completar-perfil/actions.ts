'use server'
import { redirect } from 'next/navigation'
import { readCustomerSession } from '@/lib/auth/customer-session'
import { missingCustomerFields, safeCustomerNext, textValue, validateProfileCompletion } from '@/lib/auth/customer-access'
import { assertAccountMutationOrigin } from '@/lib/auth/account-server'
import { requireRole } from '@/lib/auth/session'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { writeCustomerAsset } from '@/lib/customer-assets/service'
import type { AuthActionState } from '../actions'

export async function completeProfileAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const errorState = (message: string): AuthActionState => ({ status: 'error', email: '', message })
  try {
    await assertAccountMutationOrigin()
    const authority = await requireRole('customer')
    await enforceRateLimit('private_mutation', authority.profileId)
    const session = await readCustomerSession(authority.client)
    if (session.kind !== 'customer' || !session.verified || session.profile.id !== authority.profileId) return errorState('Tu sesión venció o falta confirmar tu email. Volvé a iniciar sesión.')
    const parsed = validateProfileCompletion(session.profile, session.address, formData)
    if (!parsed.success) return errorState('Revisá los datos pendientes. Completá nombre, teléfono y una dirección válida.')
    const data = parsed.data
    const missing = missingCustomerFields(session.profile, session.address)
    if (missing.some((key) => ['first_name', 'last_name', 'phone'].includes(key))) {
      await writeCustomerAsset(authority, 'profile', { firstName: data.first_name, lastName: data.last_name, phone: data.phone, notificationPreference: session.profile.notification_preference }, session.profile.id, session.profile.version)
    }
    if (missing.some((key) => ['street', 'number', 'city', 'province', 'property_type'].includes(key))) {
      const current = session.address
      const access = Object.fromEntries(Object.entries({
        hasElevator: current?.has_elevator, hasParking: current?.has_parking,
        stairsRequired: current?.stairs_required, outdoorUnitAtHeight: current?.outdoor_unit_at_height,
        outdoorUnitOnBalcony: current?.outdoor_unit_on_balcony, difficultAccess: current?.difficult_access
      }).filter(([, value]) => typeof value === 'boolean'))
      await writeCustomerAsset(authority, 'address', {
        label: current?.label || 'Mi hogar', street: data.street, number: data.number, city: data.city, province: data.province, propertyType: data.property_type,
        floor: current?.floor ?? null, apartment: current?.apartment ?? null, reference: current?.reference ?? null, postalCode: current?.postal_code ?? null,
        isDefault: current?.is_default ?? true, access
      }, current?.id ?? null, current?.version ?? null)
    }
    const saved = await readCustomerSession(authority.client)
    if (saved.kind !== 'customer' || missingCustomerFields(saved.profile, saved.address).length) return errorState('Todavía faltan datos para completar tu perfil. Revisalos e intentá nuevamente.')
  } catch { return errorState('No pudimos guardar tus datos. Recargá la página e intentá nuevamente.') }
  redirect(safeCustomerNext(textValue(formData, 'next')))
}
