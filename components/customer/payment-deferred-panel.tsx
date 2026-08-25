import { CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function PaymentDeferredPanel({ amount, planLabel, compact = false }: {
  amount: number
  planLabel: string
  compact?: boolean
}) {
  return (
    <Card className={compact ? 'space-y-4' : 'space-y-5 border-blue-200'}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
          <CreditCard aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Integración pendiente</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Pago pendiente de integración</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            La integración de Mercado Pago se incorporará en la etapa final
          </p>
        </div>
      </div>

      <dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Plan elegido</dt>
          <dd className="mt-1 font-bold text-slate-950">{planLabel}</dd>
        </div>
        <div className="sm:text-right">
          <dt className="font-medium text-slate-500">Presupuesto preliminar</dt>
          <dd className="mt-1 text-xl font-black tabular-nums text-slate-950">$ {amount.toLocaleString('es-AR')}</dd>
        </div>
      </dl>

      <div className="flex items-start gap-2 text-sm leading-6 text-slate-600">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
        <p>Este importe no se cobró y la solicitud no avanzará a matching hasta que exista una confirmación real.</p>
      </div>

      <Button type="button" className="w-full" disabled>
        <LockKeyhole aria-hidden="true" className="mr-2 h-4 w-4" />
        Pagar con Mercado Pago
      </Button>
    </Card>
  )
}
