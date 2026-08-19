import { cn } from '@/lib/utils/cn'

export function ProgressStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Paso {current + 1} de {steps.length}</span><span>{steps[current]}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-lysto-blue transition-all" style={{ width: `${((current + 1) / steps.length) * 100}%` }} /></div>
      <div className="hidden gap-2 sm:flex">{steps.map((step, index) => <div key={step} className={cn('h-2 flex-1 rounded-full', index <= current ? 'bg-lysto-blue' : 'bg-slate-200')} />)}</div>
    </div>
  )
}
