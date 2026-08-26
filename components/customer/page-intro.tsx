import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

export type PageIntroProps = {
  title: ReactNode
  eyebrow?: string
  description?: ReactNode
  action?: ReactNode
  visual?: ReactNode
  className?: string
}

export function PageIntro({ title, eyebrow, description, action, visual, className }: PageIntroProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end', className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow ? <Badge tone="blue">{eyebrow}</Badge> : null}
        <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        {description ? <div className="max-w-3xl text-base leading-7 text-slate-600">{description}</div> : null}
      </div>
      {action || visual ? (
        <div className="flex min-w-0 flex-col gap-3 sm:items-end">
          {visual}
          {action}
        </div>
      ) : null}
    </div>
  )
}
