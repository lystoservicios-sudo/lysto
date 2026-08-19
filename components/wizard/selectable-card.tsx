import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export function SelectableCard({ selected, title, description, icon, onClick }: { selected?: boolean; title: string; description?: string; icon?: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('w-full rounded-3xl border bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-blue-300', selected ? 'border-lysto-blue ring-4 ring-blue-100' : 'border-slate-200')}>
      <div className="flex gap-3">
        {icon ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-xl">{icon}</span> : null}
        <span><span className="block font-bold text-slate-950">{title}</span>{description ? <span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span> : null}</span>
      </div>
    </button>
  )
}
