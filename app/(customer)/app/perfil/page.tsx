import { redirect } from 'next/navigation'
import { readCustomerSession } from '@/lib/auth/customer-session'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { AccountProfileDetails } from '@/components/customer/account-details'
import { ButtonLink } from '@/components/ui/button'

export default async function CustomerProfilePage() {
  const session = await readCustomerSession()
  if (session.kind !== 'customer') redirect('/login')
  return <PageScaffold title="Tu perfil" eyebrow="Tu cuenta" description="Estos son los datos guardados para identificarte y coordinar tus servicios."><section className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><AccountProfileDetails profile={session.profile} email={session.user.email}/><div className="mt-7 border-t border-slate-100 pt-6"><p className="mb-4 text-sm text-slate-600">Si necesitás corregir tus datos, contactanos para ayudarte.</p><ButtonLink variant="secondary" href="/contacto">Contactar a Lysto</ButtonLink></div></section></PageScaffold>
}
