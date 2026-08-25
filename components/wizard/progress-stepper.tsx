import { cn } from '@/lib/utils/cn'

export function ProgressStepper({ steps, current }: { steps: string[]; current: number }) {
  const value = Math.min(steps.length, Math.max(1, current + 1))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-500"><span>Paso {value} de {steps.length}</span><span className="truncate text-right">{steps[current]}</span></div>
      <div
        role="progressbar"
        aria-label="Progreso de la solicitud"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={value}
        aria-valuetext={`Paso ${value} de ${steps.length}: ${steps[current]}`}
        className="h-2 overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-lysto-blue transition-all motion-reduce:transition-none" style={{ width: `${(value / steps.length) * 100}%` }} />
      </div>
      <ol className="hidden gap-2 sm:flex" aria-hidden="true">{steps.map((step, index) => <li key={step} className={cn('h-2 flex-1 rounded-full', index <= current ? 'bg-lysto-blue' : 'bg-slate-200')} />)}</ol>
    </div>
  )
}
