import { CalendarDays, CreditCard, UserRound, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { CustomerPaymentViewModel, CustomerUiTone } from '@/features/customer/view-models'
import { PaymentDeferredAction } from './payment-deferred-panel'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue', success: 'green', warning: 'amber', danger: 'red', benefit: 'green', neutral: 'slate'
}
const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })
const currencyFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export function PaymentMovementCard({ movement }: { movement: CustomerPaymentViewModel }) {
  const isRefund = movement.kind === 'refund'
  const displayAmount = isRefund ? -Math.abs(movement.amount) : movement.amount

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{isRefund ? 'Devolución' : 'Pago'}</p><h3 className="mt-2 text-2xl font-black tabular-nums text-slate-950">{currencyFormatter.format(displayAmount)}</h3></div>
        <Badge tone={badgeTones[movement.statusView.tone]}>{movement.statusView.label}</Badge>
      </div>
      <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div><dt className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Wrench aria-hidden="true" className="h-4 w-4" />Servicio</dt><dd className="mt-1 font-bold text-slate-950">{movement.serviceLabel}</dd></div>
        <div><dt className="flex items-center gap-2 text-xs font-semibold text-slate-500"><UserRound aria-hidden="true" className="h-4 w-4" />Profesional</dt><dd className="mt-1 font-bold text-slate-950">{movement.professionalName}</dd></div>
        <div><dt className="flex items-center gap-2 text-xs font-semibold text-slate-500"><CalendarDays aria-hidden="true" className="h-4 w-4" />Fecha</dt><dd className="mt-1 font-bold text-slate-950"><time dateTime={movement.createdAt}>{dateFormatter.format(new Date(movement.createdAt))}</time></dd></div>
        <div><dt className="flex items-center gap-2 text-xs font-semibold text-slate-500"><CreditCard aria-hidden="true" className="h-4 w-4" />Medio</dt><dd className="mt-1 font-bold text-slate-950">{movement.methodLabel ?? 'Medio protegido'}</dd></div>
      </dl>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <PaymentDeferredAction action="receipt" showStatus={false} />
        <PaymentDeferredAction action={isRefund ? 'detail' : 'refund'} showStatus={false} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Las acciones permanecen inactivas hasta consultar capacidades reales del pago.</p>
    </article>
  )
}
