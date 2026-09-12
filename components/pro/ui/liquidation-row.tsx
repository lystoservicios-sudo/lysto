import { CheckCircle2, Clock, Wallet, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
type PaymentRecord = {
  status: string
  professionalAmount: number
  jobId: string
  customer: string
  amount: number
  platformFee: number
  createdAt: string
}

function money(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  })
}

const statusConfig = {
  approved: {
    label: 'Aprobada',
    color: 'bg-green-50 text-green-700 border border-green-200',
    icon: <CheckCircle2 className="h-4 w-4 text-lysto-green" />,
    bg: 'bg-green-50'
  },
  captured: {
    label: 'En proceso',
    color: 'bg-blue-50 text-blue-700 border border-blue-200',
    icon: <Clock className="h-4 w-4 text-lysto-blue" />,
    bg: 'bg-blue-50'
  },
  pending: {
    label: 'Pendiente',
    color: 'bg-amber-50 text-amber-700 border border-amber-200',
    icon: <Wallet className="h-4 w-4 text-lysto-warning" />,
    bg: 'bg-amber-50'
  }
}

export function LiquidationRow({ payment }: { payment: PaymentRecord }) {
  const config = statusConfig[payment.status as keyof typeof statusConfig] ?? statusConfig.pending

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-lysto-border last:border-0">
      {/* Status icon circle */}
      <div
        className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
          config.bg
        )}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black',
              config.color
            )}
          >
            {config.label}
          </span>
        </div>
        <p className="text-base font-black text-lysto-ink mt-0.5">
          {money(payment.professionalAmount)}
        </p>
        <p className="text-xs text-lysto-muted">
          Trabajo {payment.jobId} · {payment.customer}
        </p>
        <p className="text-[10px] text-slate-400">
          Total cliente {money(payment.amount)} · Comisión Lysto {money(payment.platformFee)}
        </p>
      </div>

      {/* Date + arrow */}
      <div className="shrink-0 flex items-center gap-1.5 text-lysto-muted">
        <Calendar className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{payment.createdAt.split(' ')[0]}</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  )
}
