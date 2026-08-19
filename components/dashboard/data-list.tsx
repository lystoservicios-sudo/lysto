import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function DataList({ title, description, children, action }: { title: string; description?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="p-0">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </Card>
  )
}

export function DataRow({ title, subtitle, meta, status, children }: { title: string; subtitle?: string; meta?: string; status?: string; children?: ReactNode }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-black text-slate-950">{title}</h3>
          {status ? <Badge tone="blue">{status}</Badge> : null}
        </div>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        {meta ? <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{meta}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div> : null}
    </div>
  )
}
