'use server'

import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { readCustomerSession } from '@/lib/auth/customer-session'
import { missingCustomerFields, safeCustomerNext, textValue, validateProfileCompletion } from '@/lib/auth/customer-access'
import type { AuthActionState } from '../actions'

export async function completeProfileAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const errorState = (message: string): AuthActionState => ({ status: 'error', email: '', message })
  try {
    const supabase = await createServerSupabaseClient() as unknown as SupabaseClient<Database>
    const session = await readCustomerSession(supabase)
    if (session.kind !== 'customer' || !session.verified) return errorState('Tu sesión venció o falta confirmar tu email. Volvé a iniciar sesión.')
    const parsed = validateProfileCompletion(session.profile, session.address, formData)
    if (!parsed.success) return errorState('Revisá los datos pendientes. Completá nombre, teléfono y una dirección válida.')
    const data = parsed.data
    const missing = missingCustomerFields(session.profile, session.address)
    if (missing.some((key) => ['first_name', 'last_name', 'phone'].includes(key))) {
      const { error, data: saved } = await supabase.from('profiles').update({ first_name: data.first_name, last_name: data.last_name, phone: data.phone }).eq('id', session.profile.id).select('id').maybeSingle()
      if (error || !saved) return errorState('No pudimos guardar tus datos. Intentá nuevamente.')
    }
    if (missing.some((key) => ['street', 'number', 'city', 'province', 'property_type'].includes(key))) {
      const address = { street: data.street, number: data.number, city: data.city, province: data.province, property_type: data.property_type }
      const result = session.address
        ? await supabase.from('customer_addresses').update(address).eq('id', session.address.id).eq('customer_id', session.customer.id).select('id').maybeSingle()
        : await supabase.from('customer_addresses').insert({ ...address, customer_id: session.customer.id, is_default: true }).select('id').single()
      if (result.error || !result.data) return errorState('No pudimos guardar la dirección. Revisala e intentá nuevamente.')
    }
    const saved = await readCustomerSession(supabase)
    if (saved.kind !== 'customer' || missingCustomerFields(saved.profile, saved.address).length) return errorState('Todavía faltan datos para completar tu perfil. Revisalos e intentá nuevamente.')
  } catch { return errorState('No pudimos conectarnos con Lysto. Intentá nuevamente.') }
  redirect(safeCustomerNext(textValue(formData, 'next')))
}
