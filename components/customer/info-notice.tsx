import { CircleCheck, Info, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

type NoticeTone = 'info' | 'success' | 'warning' | 'security'
type NoticeLive = 'off' | 'polite' | 'assertive'

const noticeStyles: Record<NoticeTone, { surface: string; icon: string; defaultIcon: ReactNode }> = {
  info: { surface: 'border-blue-200 bg-blue-50 text-blue-950', icon: 'bg-white text-blue-700', defaultIcon: <Info aria-hidden="true" className="h-5 w-5" /> },
  success: { surface: 'border-emerald-200 bg-emerald-50 text-emerald-950', icon: 'bg-white text-emerald-700', defaultIcon: <CircleCheck aria-hidden="true" className="h-5 w-5" /> },
  warning: { surface: 'border-amber-200 bg-amber-50 text-amber-950', icon: 'bg-white text-amber-700', defaultIcon: <TriangleAlert aria-hidden="true" className="h-5 w-5" /> },
  security: { surface: 'border-violet-200 bg-violet-50 text-violet-950', icon: 'bg-white text-violet-700', defaultIcon: <ShieldCheck aria-hidden="true" className="h-5 w-5" /> }
}

export function InfoNotice({ tone = 'info', title, description, icon, action, live = 'off', className }: {
  tone?: NoticeTone
  title: string
  description: ReactNode
  icon?: ReactNode
  action?: ReactNode
  live?: NoticeLive
  className?: string
}) {
  const styles = noticeStyles[tone]

  return (
    <div
      role={live === 'assertive' ? 'alert' : live === 'polite' ? 'status' : undefined}
      aria-live={live === 'off' ? undefined : live}
      className={cn('flex flex-col gap-4 rounded-3xl border p-4 sm:flex-row sm:items-center', styles.surface, className)}
    >
      <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', styles.icon)}>{icon ?? styles.defaultIcon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-black">{title}</p>
        <div className="mt-1 text-sm leading-6 opacity-80">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
