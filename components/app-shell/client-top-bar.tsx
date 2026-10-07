import Link from 'next/link'
import { Bell, CircleUserRound } from 'lucide-react'

import type { AccountIdentity } from '@/lib/auth/account-identity'

function initials(name?: string) {
  return name?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function ClientTopBar({ identity }: { identity?: AccountIdentity }) {
  const avatarInitials = initials(identity?.name)

  return (
    <header
      className="z-30 flex min-h-16 items-center justify-between border-b border-slate-200/80 bg-white px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Link href="/app" aria-label="Lysto, inicio" className="inline-flex min-h-12 items-center gap-2 rounded-xl text-xl font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
        <svg viewBox="0 0 34 38" width="24" height="27" aria-hidden="true" className="text-blue-700"><path d="M9 1a7 7 0 0 1 7 7v16h10a7 7 0 0 1 0 14H9a7 7 0 0 1-7-7V8a7 7 0 0 1 7-7Z" fill="currentColor" /><path d="M16 24v7a7 7 0 0 1-7 7h17a7 7 0 0 0 0-14Z" fill="white" opacity=".17" /></svg>
        <span>lysto<span className="text-blue-700">.</span></span>
      </Link>

      <div className="flex items-center gap-1">
        <button type="button" disabled aria-label="Notificaciones próximamente" className="grid h-12 w-12 place-items-center rounded-xl text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <Bell aria-hidden="true" className="h-5 w-5" />
          <span data-badge-slot aria-hidden="true" />
        </button>
        <Link href="/app/perfil" aria-label="Abrir Cuenta" className="grid h-12 w-12 place-items-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          {avatarInitials ? <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold">{avatarInitials}</span> : <CircleUserRound aria-hidden="true" className="h-6 w-6" />}
        </Link>
      </div>
    </header>
  )
}
