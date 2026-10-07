import Link from 'next/link'
import { AirVent, CircleUserRound, House, LayoutGrid, Plus } from 'lucide-react'

type ClientNavigationIcon = 'grid' | 'home' | 'plus' | 'equipment' | 'account'

const icons = {
  grid: LayoutGrid,
  home: House,
  plus: Plus,
  equipment: AirVent,
  account: CircleUserRound
} as const

export function ClientNavItem({
  label,
  href,
  icon,
  active,
  primary = false
}: {
  label: string
  href: string
  icon: ClientNavigationIcon
  active: boolean
  primary?: boolean
}) {
  const Icon = icons[icon]
  const accessibleLabel = primary ? 'Pedir un servicio' : label

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      aria-label={accessibleLabel}
      data-primary={primary || undefined}
      className={primary
        ? 'relative flex min-h-12 flex-col items-center justify-end gap-1 pb-1 text-xs font-semibold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
        : `flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${active ? 'text-blue-700' : 'text-slate-600'}`}
    >
      {primary ? (
        <span className="-mt-7 grid h-12 w-12 place-items-center rounded-full bg-blue-700 text-white shadow-md shadow-blue-950/20" aria-hidden="true">
          <Icon className="h-6 w-6" />
        </span>
      ) : <Icon aria-hidden="true" className="h-5 w-5" />}
      <span>{label}</span>
    </Link>
  )
}
