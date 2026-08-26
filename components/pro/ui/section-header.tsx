import type { ReactNode } from 'react'

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="space-y-1 mb-5">
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lysto-blueSoft px-3 py-1 text-xs font-bold text-lysto-blue">
          {eyebrow}
        </span>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-black tracking-tight text-lysto-ink sm:text-3xl">{title}</h1>
        {action}
      </div>
      {subtitle && <p className="text-sm text-lysto-muted leading-relaxed max-w-xl">{subtitle}</p>}
    </div>
  )
}
