import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function SupportItem({
  icon,
  iconBg,
  title,
  description,
  onClick
}: {
  icon: ReactNode
  iconBg: string
  title: string
  description: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-white border border-lysto-border rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
    >
      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-lysto-ink text-sm">{title}</p>
        <p className="text-xs text-lysto-muted leading-relaxed mt-0.5">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
    </button>
  )
}
