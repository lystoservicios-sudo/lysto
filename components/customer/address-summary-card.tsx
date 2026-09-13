import { Building2, Car, MapPin, MoveUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { CustomerAddressViewModel } from '@/features/customer/view-models'

export function AddressSummaryCard({ address }: { address: CustomerAddressViewModel }) {
  const access = [
    address.access.hasElevator ? { label: 'Con ascensor', icon: MoveUp } : null,
    address.access.hasParking ? { label: 'Con estacionamiento', icon: Car } : null,
    address.access.difficultAccess ? { label: 'Acceso complejo', icon: Building2 } : null
  ].filter((item): item is { label: string; icon: typeof MoveUp } => Boolean(item))

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <MapPin aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black text-slate-950">{address.label}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {address.street} {address.number}
              {address.floor ? ` · Piso ${address.floor}` : ''}
              {address.apartment ? ` ${address.apartment}` : ''}
              <br />
              {address.city}, {address.province}
            </p>
          </div>
        </div>
        <Badge tone="blue">Dirección registrada</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {access.length ? (
          access.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {label}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-500">Sin condiciones especiales informadas.</span>
        )}
      </div>
    </article>
  )
}
