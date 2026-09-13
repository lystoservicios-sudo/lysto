import { Home, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'

type AccountAddress = { street: string; number: string; floor?: string | null; apartment?: string | null; city: string; province: string; property_type: string }
export function AccountAddressDetails({ address }: { address: AccountAddress | null }) {
  if (!address) return <p className="text-slate-600">Completá tu dirección para coordinar una visita.</p>
  return <div className="space-y-2"><p className="text-xl font-bold text-slate-950">{address.street} {address.number}</p>{(address.floor || address.apartment) && <p className="text-slate-600">{address.floor ? `Piso ${address.floor}` : ''}{address.floor && address.apartment ? ' · ' : ''}{address.apartment ? `Departamento ${address.apartment}` : ''}</p>}<p className="text-slate-600">{address.city}, {address.province}</p><p className="text-sm text-slate-500">{({ house: 'Casa', apartment: 'Departamento', office: 'Oficina', commercial: 'Local comercial' } as Record<string, string>)[address.property_type] ?? address.property_type}</p></div>
}

export function AccountProfileDetails({ profile, email }: { profile: { first_name: string; last_name: string; phone: string | null }; email?: string }) {
  return <dl className="divide-y divide-slate-100">{[
    { label: 'Nombre y apellido', value: `${profile.first_name} ${profile.last_name}`, icon: UserRound },
    { label: 'Email de tu cuenta', value: email, icon: Mail },
    { label: 'Teléfono de contacto', value: profile.phone, icon: Phone }
  ].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-start gap-4 py-5 first:pt-0 last:pb-0"><Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-blue-600"/><div className="min-w-0"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-950">{value || 'Pendiente de completar'}</dd></div></div>)}</dl>
}

export function CustomerAccountEntry({ firstName, address }: { firstName: string; address: AccountAddress | null }) {
  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-blue-50 p-6 sm:p-10">
      <div className="relative z-10 max-w-2xl"><p className="text-sm font-semibold text-blue-700">Tu hogar con Lysto</p><h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">Hola, {firstName}</h1><p className="mt-4 max-w-lg text-lg leading-7 text-slate-600">Tu próximo servicio empieza acá. Contanos qué necesita tu aire y te guiamos paso a paso.</p><ButtonLink className="mt-7" size="lg" href="/app/solicitar/aire-acondicionado">Solicitar servicio</ButtonLink></div>
      <Home aria-hidden="true" className="absolute -bottom-10 -right-8 h-64 w-64 rotate-12 text-blue-100" strokeWidth={1}/>
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><MapPin aria-hidden="true" className="mb-4 text-blue-600"/><h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Tu dirección para empezar</h2><AccountAddressDetails address={address}/><p className="mt-5 text-sm leading-6 text-slate-500">Podés revisar la dirección y los accesos al pedir un servicio.</p></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-xl font-bold text-slate-950">Todo a mano</h2><p className="mt-2 text-slate-600">Retomá una propuesta guardada o revisá tus movimientos.</p><div className="mt-6 flex flex-col items-start gap-3"><ButtonLink variant="secondary" href="/app/presupuestos">Mis presupuestos</ButtonLink><ButtonLink variant="ghost" href="/app/pagos">Mis pagos</ButtonLink><ButtonLink variant="ghost" href="/app/perfil">Datos de mi cuenta</ButtonLink></div></section>
    </div>
  </div>
}
