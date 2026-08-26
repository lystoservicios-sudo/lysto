import { CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

export type DeferredPaymentAction = 'pay' | 'retry' | 'reserve' | 'receipt' | 'refund' | 'movements' | 'detail'

const actionCopy: Record<DeferredPaymentAction, { title: string; label: string }> = {
  pay: { title: 'Pago pendiente de integración', label: 'Pagar con Mercado Pago' },
  retry: { title: 'Reintento de pago pendiente', label: 'Reintentar pago' },
  reserve: { title: 'Reserva adicional pendiente', label: 'Reservar importe adicional' },
  receipt: { title: 'Comprobante pendiente de integración', label: 'Ver comprobante' },
  refund: { title: 'Devolución pendiente de integración', label: 'Solicitar devolución' },
  movements: { title: 'Movimientos todavía no conectados', label: 'Consultar movimientos' },
  detail: { title: 'Detalle pendiente de integración', label: 'Ver detalle' }
}

export function PaymentDeferredPanel({ amount, planLabel, compact = false, action = 'pay' }: {
  amount?: number
  planLabel?: string
  compact?: boolean
  action?: DeferredPaymentAction
}) {
  const copy = actionCopy[action]

  return (
    <Card className={compact ? 'space-y-4' : 'space-y-5 border-blue-200'}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
          <CreditCard aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Integración pendiente</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            La integración de Mercado Pago se incorporará en la etapa final
          </p>
        </div>
      </div>

      {planLabel || amount !== undefined ? (
        <dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          {planLabel ? <div><dt className="font-medium text-slate-500">Concepto</dt><dd className="mt-1 font-bold text-slate-950">{planLabel}</dd></div> : null}
          {amount !== undefined ? <div className="sm:text-right"><dt className="font-medium text-slate-500">Importe informado</dt><dd className="mt-1 text-xl font-black tabular-nums text-slate-950">$ {amount.toLocaleString('es-AR')}</dd></div> : null}
        </dl>
      ) : null}

      <div className="flex items-start gap-2 text-sm leading-6 text-slate-600">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
        <p>{amount !== undefined ? 'Este importe no se cobró y ningún estado avanzará hasta que exista una confirmación real.' : 'No se consultaron ni generaron movimientos, comprobantes o devoluciones.'}</p>
      </div>

      <PaymentDeferredAction action={action} />
    </Card>
  )
}

export function PaymentDeferredAction({ action, className, showStatus = true }: {
  action: DeferredPaymentAction
  className?: string
  showStatus?: boolean
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Button type="button" className="w-full" variant={action === 'pay' || action === 'reserve' ? 'primary' : 'secondary'} disabled>
        <LockKeyhole aria-hidden="true" className="mr-2 h-4 w-4" />
        {actionCopy[action].label}
      </Button>
      {showStatus ? <p className="text-center text-xs font-semibold leading-5 text-slate-500">Integración pendiente · No se ejecutó ninguna operación.</p> : null}
    </div>
  )
}
