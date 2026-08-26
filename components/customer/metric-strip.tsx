import type { ReactNode } from 'react'

import { EmptyState } from './states'
import { cn } from '@/lib/utils/cn'

export type MetricStripItem = {
  id: string
  label: string
  value: ReactNode
  description?: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'success' | 'warning' | 'benefit' | 'neutral'
}

const valueTones: Record<NonNullable<MetricStripItem['tone']>, string> = {
  brand: 'text-blue-700',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  benefit: 'text-violet-700',
  neutral: 'text-slate-950'
}

export function MetricValue({ item, layout = 'stacked', className }: {
  item: MetricStripItem
  layout?: 'inline' | 'stacked'
  className?: string
}) {
  return (
    <div className={cn(layout === 'inline' ? 'flex items-center justify-between gap-4' : 'space-y-2', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          {item.icon}
          <span>{item.label}</span>
        </div>
        {item.description ? <div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div> : null}
      </div>
      <div className={cn('shrink-0 text-2xl font-black tracking-tight tabular-nums', valueTones[item.tone ?? 'neutral'])}>{item.value}</div>
    </div>
  )
}

export function MetricStrip({ items, emptyTitle = 'No hay métricas disponibles', className }: {
  items: readonly MetricStripItem[]
  emptyTitle?: string
  className?: string
}) {
  if (!items.length) {
    return <EmptyState compact title={emptyTitle} description="La información aparecerá cuando haya actividad disponible." />
  }

  return (
    <dl className={cn('grid overflow-hidden rounded-3xl border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map((item) => (
        <div key={item.id} className="border-b border-slate-100 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
          <dt className="sr-only">{item.label}</dt>
          <dd><MetricValue item={item} /></dd>
        </div>
      ))}
    </dl>
  )
}
