import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-slate-950">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-lysto-blue text-white shadow-soft">L</span>
          <span>Lysto</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/servicios/aire-acondicionado">Aire acondicionado</Link>
          <Link href="/como-funciona">Cómo funciona</Link>
          <Link href="/ayuda">Ayuda</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" className="hidden sm:inline-flex">Ingresar</ButtonLink>
          <ButtonLink href="/registro">Solicitar</ButtonLink>
        </div>
      </div>
    </header>
  )
}
