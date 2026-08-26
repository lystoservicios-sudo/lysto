import { CheckCircle2, Clock, PlayCircle, BookOpen, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type ModuleStatus = 'completed' | 'in_progress' | 'pending'

const moduleIcons: string[] = ['🏠', '🌡️', '📸', '🛡️', '🔧', '💬']

export function ModuleCard({
  index,
  title,
  description,
  status,
  progress,
}: {
  index: number
  title: string
  description: string
  status: ModuleStatus
  progress: number
}) {
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'
  const statusBadge = {
    completed: { label: 'Completado', color: 'text-lysto-green bg-green-50 border border-green-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    in_progress: { label: 'En progreso', color: 'text-lysto-blue bg-blue-50 border border-blue-200', icon: <Clock className="h-3 w-3" /> },
    pending: { label: 'Pendiente', color: 'text-lysto-muted bg-slate-50 border border-slate-200', icon: <Clock className="h-3 w-3" /> },
  }[status]

  const ctaLabel = isCompleted ? 'Repasar módulo' : isInProgress ? 'Continuar módulo' : 'Comenzar módulo'
  const CtaIcon = isCompleted ? BookOpen : PlayCircle
  const ctaStyle = isInProgress
    ? 'bg-lysto-blue text-white hover:bg-lysto-blueDark'
    : 'border border-lysto-border bg-white text-lysto-ink hover:bg-slate-50'

  return (
    <div className="lysto-card-animate rounded-2xl bg-white border border-lysto-border shadow-[0_1px_3px_rgba(7,19,47,0.06)] p-4 space-y-3 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-lysto-blue">Módulo {index + 1}</span>
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', statusBadge.color)}>
          {statusBadge.icon}
          {statusBadge.label}
        </span>
      </div>

      {/* Icon + title */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl bg-lysto-blueSoft flex items-center justify-center text-2xl shrink-0">
          {moduleIcons[index] ?? '📚'}
        </div>
        <div className="min-w-0">
          <p className="font-black text-lysto-ink text-sm leading-tight">{title}</p>
          <p className="mt-1 text-xs text-lysto-muted leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5 flex-1">
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full lysto-progress-fill', isCompleted ? 'bg-lysto-green' : isInProgress ? 'bg-lysto-blue' : 'bg-slate-200')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-end">
          <span className={cn('text-xs font-bold', isCompleted ? 'text-lysto-green' : isInProgress ? 'text-lysto-blue' : 'text-lysto-muted')}>
            {progress}%
          </span>
        </div>
      </div>

      {/* CTA */}
      <button className={cn('w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors', ctaStyle)}>
        <CtaIcon className="h-4 w-4" />
        {ctaLabel}
        {isInProgress && <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  )
}
