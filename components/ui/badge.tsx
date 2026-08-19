import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'slate'
const tones: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200'
}

export function Badge({ className, tone = 'blue', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1', tones[tone], className)} {...props} />
}
