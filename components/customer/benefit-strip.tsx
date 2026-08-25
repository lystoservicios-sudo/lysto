import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type BenefitStripItem = {
  id: string
  title: string
  description: string
  icon: ReactNode
}

export function BenefitStrip({ items, className }: { items: readonly BenefitStripItem[]; className?: string }) {
  return (
    <ul className={cn('grid gap-px overflow-hidden rounded-2xl border border-blue-100 bg-blue-100 md:grid-cols-3', className)}>
      {items.map((item) => (
        <li key={item.id} className="bg-white/90 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">{item.icon}</div>
          <p className="mt-3 font-black text-slate-950">{item.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
        </li>
      ))}
    </ul>
  )
}
