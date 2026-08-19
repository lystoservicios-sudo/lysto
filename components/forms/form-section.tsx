import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

export function FormSection({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-5">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  )
}
