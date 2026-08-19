import { cn } from '@/lib/utils/cn'

export function StatusTimeline({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3">
          <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black', index <= current ? 'bg-lysto-blue text-white' : 'bg-slate-200 text-slate-500')}>{index + 1}</span>
          <span className="pt-1 text-sm font-semibold text-slate-700">{step}</span>
        </li>
      ))}
    </ol>
  )
}
