import { cn } from '@/lib/utils/cn'

type JobStatus = string

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  technician_on_way: { label: 'EN CAMINO', color: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500 animate-pulse' },
  confirmed: { label: 'CONFIRMADO', color: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
  arrived: { label: 'EN DOMICILIO', color: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
  onsite_diagnosis: { label: 'DIAGNÓSTICO', color: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  waiting_customer_approval: { label: 'ESPERANDO APROBACIÓN', color: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
  in_progress: { label: 'EN CURSO', color: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
  completed_pending_customer_confirmation: { label: 'POR CERRAR', color: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  completed: { label: 'COMPLETADO', color: 'bg-slate-50 text-slate-600 border border-slate-200', dot: 'bg-slate-400' },
  pending_assignment: { label: 'SIN ASIGNAR', color: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' },
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const config = statusConfig[status] ?? {
    label: status.toUpperCase().replace(/_/g, ' '),
    color: 'bg-slate-50 text-slate-600 border border-slate-200',
    dot: 'bg-slate-400',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide', config.color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} />
      {config.label}
    </span>
  )
}
