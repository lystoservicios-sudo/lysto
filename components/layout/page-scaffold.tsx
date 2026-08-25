import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { PageIntro } from '@/components/customer/page-intro'

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
      <PageIntro title={title} eyebrow={eyebrow} description={description} />
      {items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <Card key={item} className="p-4 text-sm font-semibold text-slate-700">{item}</Card>)}</div> : null}
      {children}
    </section>
  )
}
