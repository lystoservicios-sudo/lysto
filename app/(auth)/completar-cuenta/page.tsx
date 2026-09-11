import { redirect } from 'next/navigation'
import { PublicShell } from '@/components/layout/page-shell'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { bootstrapVerifiedCustomer } from '@/lib/auth/account-server'
import { RegistrationForm } from '../registro/registration-form'

export const dynamic = 'force-dynamic'
export default async function CompleteAccountPage() {
  const client = await createServerSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user || user.app_metadata.app_role !== 'customer') redirect('/login')
  if (await bootstrapVerifiedCustomer(client,user) === 'ready') redirect('/app')
  const policy = await getRegistrationPolicy()
  return <PublicShell><main className="mx-auto max-w-xl px-4 py-12"><h1 className="text-3xl font-black">Completá tu cuenta</h1><p className="mt-3 text-sm leading-6">Tu acceso ya existe. Sólo necesitamos estos datos para habilitar tus servicios.</p>{policy ? <RegistrationForm policy={policy} completing /> : <p className="mt-6" role="status">Todavía no podemos habilitar nuevas cuentas. Tu acceso se conserva.</p>}</main></PublicShell>
}
