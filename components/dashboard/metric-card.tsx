import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import type { Metric } from '@/lib/mock/lysto-data'

const toneClasses: Record<NonNullable<Metric['tone']>, string> = {
  blue: 'bg-blue-50 text-blue-950 border-blue-100',
  green: 'bg-emerald-50 text-emerald-950 border-emerald-100',
  amber: 'bg-amber-50 text-amber-950 border-amber-100',
  red: 'bg-red-50 text-red-950 border-red-100',
  slate: 'bg-slate-50 text-slate-950 border-slate-200'
}

export function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Card className={cn('p-4', toneClasses[metric.tone ?? 'slate'])}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{metric.label}</p>
      <p className="mt-2 text-2xl font-black sm:text-3xl">{metric.value}</p>
      <p className="mt-1 text-sm font-semibold opacity-75">{metric.helper}</p>
    </Card>
  )
}

export function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
}
