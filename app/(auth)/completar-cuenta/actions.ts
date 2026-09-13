'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { accountFormText, assertAccountMutationOrigin } from '@/lib/auth/account-server'
import type { AccountResult } from '@/lib/auth/account-lifecycle'
import { enforceRateLimit, serverActionSubject } from '@/lib/security/rate-limit'
import { resolvedCustomerDestination } from '@/lib/auth/customer-session'
import { safeCustomerNext } from '@/lib/auth/customer-access'

export async function completeAccountAction(_previous: AccountResult, form: FormData): Promise<AccountResult> {
  try {
    await assertAccountMutationOrigin()
    await enforceRateLimit('registration', await serverActionSubject('complete-account'))
    const client = await createServerSupabaseClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user?.email_confirmed_at || user.app_metadata.app_role !== 'customer') return { status: 'error', message: 'Iniciá sesión con una cuenta cliente confirmada.' }
    const policy = await getRegistrationPolicy()
    if (!policy || form.get('accepted') !== 'on' || form.get('termsVersion') !== policy.termsVersion || form.get('privacyVersion') !== policy.privacyVersion) return { status: 'error', message: 'Revisá y aceptá los documentos vigentes antes de continuar.' }
    const parsed = z.object({ first: z.string().trim().min(1).max(100), last: z.string().trim().min(1).max(100), phone: z.string().trim().max(40).refine(value => value.replace(/\D/g, '').length >= 8) }).safeParse({ first: accountFormText(form,'firstName'), last: accountFormText(form,'lastName'), phone: accountFormText(form,'phone') })
    if (!parsed.success) return { status: 'error', message: 'Revisá tu nombre, apellido y teléfono.' }
    const result = await client.rpc('complete_customer_registration', { p_first_name: parsed.data.first, p_last_name: parsed.data.last, p_phone: parsed.data.phone, p_terms_version: policy.termsVersion, p_privacy_version: policy.privacyVersion, p_accepted: true })
    if (result.error) return { status: 'error', message: 'No pudimos completar tu cuenta. Tus datos de acceso siguen vigentes; intentá nuevamente.' }
  } catch { return { status: 'error', message: 'No pudimos completar tu cuenta. Intentá nuevamente.' } }
  redirect(await resolvedCustomerDestination(safeCustomerNext(accountFormText(form, 'next'))))
}
