import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export type QuickAction = {
  id: string
  title: string
  description: string
  href: string
  icon: ReactNode
}

export function QuickActionGrid({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.id}
          href={action.href}
          className="group flex min-h-32 items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700 group-hover:bg-white group-hover:text-blue-700">{action.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-black text-slate-950">{action.title}</span>
            <span className="mt-1 block text-sm leading-5 text-slate-600">{action.description}</span>
          </span>
          <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-700" />
        </Link>
      ))}
    </div>
  )
}
