import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

export function InfoBanner({
  icon,
  title,
  description
}: {
  icon?: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white border border-lysto-border px-4 py-3.5 shadow-[0_1px_2px_rgba(7,19,47,0.04)]">
      <div className="h-10 w-10 rounded-xl bg-lysto-blueSoft flex items-center justify-center shrink-0">
        {icon ?? <ShieldCheck className="h-5 w-5 text-lysto-blue" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-lysto-ink">{title}</p>
        <p className="text-xs text-lysto-muted">{description}</p>
      </div>
    </div>
  )
}
