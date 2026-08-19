import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export function RecordList({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-0">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </Card>
  )
}

export function RecordRow({ title, subtitle, meta, badge, children }: { title: string; subtitle?: string; meta?: string; badge?: string; children?: ReactNode }) {
  return (
    <div className="grid gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-black text-slate-950">{title}</h3>
          {badge ? <Badge tone="blue">{badge}</Badge> : null}
        </div>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        {meta ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{meta}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2 lg:justify-end">{children}</div> : null}
    </div>
  )
}
