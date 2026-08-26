import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

export function MetricCard({
  icon,
  label,
  value,
  description,
  tone = 'blue'
}: {
  icon: ReactNode
  label: string
  value: string
  description: string
  tone?: 'blue' | 'green' | 'slate'
}) {
  const toneClasses = {
    blue: 'text-lysto-blue',
    green: 'text-lysto-green',
    slate: 'text-slate-600',
  }

  return (
    <div className="rounded-2xl bg-white border border-lysto-border shadow-[0_1px_3px_rgba(7,19,47,0.06)] p-4 space-y-2">
      <div className="flex items-center gap-2 text-lysto-muted">
        {icon}
        <span className="text-xs font-semibold text-lysto-muted">{label}</span>
      </div>
      <p className={cn('text-2xl font-black leading-none', toneClasses[tone])}>{value}</p>
      <p className="text-xs text-lysto-muted">{description}</p>
    </div>
  )
}
