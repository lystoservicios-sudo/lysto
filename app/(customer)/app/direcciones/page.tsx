import { redirect } from 'next/navigation'
import { readCustomerSession } from '@/lib/auth/customer-session'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { AccountAddressDetails } from '@/components/customer/account-details'
import { ButtonLink } from '@/components/ui/button'

export default async function CustomerAddressesPage() {
  const session = await readCustomerSession()
  if (session.kind !== 'customer') redirect('/login')
  return <PageScaffold title="Tu dirección" eyebrow="Tu hogar" description="La dirección que completaste al crear tu perfil."><section className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><AccountAddressDetails address={session.address}/><p className="my-6 text-sm leading-6 text-slate-600">Al pedir un servicio podés ajustar la dirección y los detalles de acceso para esa visita.</p><ButtonLink href="/app/solicitar/aire-acondicionado">Solicitar servicio</ButtonLink></section></PageScaffold>
}
