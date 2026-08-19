import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function PageScaffold({
  title,
  eyebrow,
  description,
  children,
  items = []
}: {
  title: string
  eyebrow?: string
  description?: string
  children?: ReactNode
  items?: string[]
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        {eyebrow ? <Badge tone="blue">{eyebrow}</Badge> : null}
        <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        {description ? <p className="max-w-3xl text-base leading-7 text-slate-600">{description}</p> : null}
      </div>
      {items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <Card key={item} className="p-4 text-sm font-semibold text-slate-700">{item}</Card>)}</div> : null}
      {children}
    </section>
  )
}
