import type { ReactNode } from 'react'

export function PageScaffold({
  title,
  eyebrow,
  description,
  children,
  action
}: {
  title: string
  eyebrow?: string
  description?: string
  children?: ReactNode
  items?: string[]
  action?: ReactNode
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        {eyebrow ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lysto-blueSoft px-3 py-1 text-xs font-bold text-lysto-blue">
            {eyebrow}
          </span>
        ) : null}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black tracking-tight text-lysto-ink sm:text-3xl">{title}</h1>
          {action}
        </div>
        {description ? <p className="text-sm leading-6 text-lysto-muted max-w-xl">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
