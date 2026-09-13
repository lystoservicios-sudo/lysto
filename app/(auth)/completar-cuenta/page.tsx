import { redirect } from 'next/navigation'
import { AuthFrame } from '@/components/auth/auth-frame'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { bootstrapVerifiedCustomer } from '@/lib/auth/account-server'
import { resolvedCustomerDestination } from '@/lib/auth/customer-session'
import { safeCustomerNext } from '@/lib/auth/customer-access'
import { RegistrationForm } from '../registro/registration-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Completá tu cuenta | Lysto', robots: { index: false, follow: false } }
export default async function CompleteAccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeCustomerNext((await searchParams).next)
  const client = await createServerSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user || user.app_metadata.app_role !== 'customer') redirect('/login')
  if (!user.email_confirmed_at) redirect('/login?notice=confirm-email')
  if (await bootstrapVerifiedCustomer(client, user) === 'ready') redirect(await resolvedCustomerDestination(next, client))
  const policy = await getRegistrationPolicy()
  // Provider metadata is only an editable form suggestion, never authorization.
  const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 100) : ''
  const initialValues = { firstName: text(user.user_metadata.first_name ?? user.user_metadata.given_name), lastName: text(user.user_metadata.last_name ?? user.user_metadata.family_name), phone: text(user.user_metadata.phone) }
  return <AuthFrame eyebrow="UN PASO MÁS" title="Terminemos de conocernos." description="Tu acceso ya existe. Revisá tus datos y los documentos para continuar.">{policy ? <RegistrationForm policy={policy} completing next={next} initialValues={initialValues} /> : <p className="auth-notice" role="status">Todavía no podemos habilitar nuevas cuentas. Tu acceso se conserva.</p>}</AuthFrame>
}
