import { Card } from '@/components/ui/card'
import type { LystoMetric } from '@/lib/mock/lysto-data'
import { cn } from '@/lib/utils/cn'

const tones: Record<NonNullable<LystoMetric['tone']>, string> = {
  blue: 'bg-blue-50 text-blue-900 ring-blue-100',
  green: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-900 ring-amber-100',
  red: 'bg-red-50 text-red-900 ring-red-100',
  slate: 'bg-slate-50 text-slate-900 ring-slate-100'
}

export function MetricGrid({ metrics }: { metrics: LystoMetric[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
}

export function MetricCard({ metric }: { metric: LystoMetric }) {
  return (
    <Card className={cn('ring-4', tones[metric.tone ?? 'slate'])}>
      <p className="text-sm font-semibold opacity-80">{metric.label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{metric.value}</p>
      <p className="mt-2 text-xs font-medium opacity-75">{metric.helper}</p>
    </Card>
  )
}
