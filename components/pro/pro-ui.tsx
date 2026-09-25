'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Home,
  Search,
  UserRound,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { PageIntro } from '@/components/customer/page-intro'
import { FormFeedback } from '@/components/customer/states'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

export function ProWorkspace({ children, pending = false }: { children: ReactNode; pending?: boolean }) {
  const pathname = usePathname()
  const onboarding = pathname.startsWith('/pro/onboarding/')
  return (
    <div className="pro-workspace">
      {children}
      {!onboarding && !pending && (
        <nav className="pro-bottom-nav" aria-label="Navegación profesional móvil">
          {(
            [
              ['Inicio', '/pro/dashboard', Home],
              ['Solicitudes', '/pro/solicitudes', ClipboardList],
              ['Trabajos', '/pro/trabajos', Wrench],
              ['Agenda', '/pro/agenda', CalendarDays],
              ['Perfil', '/pro/perfil', UserRound]
            ] as const
          ).map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined
              }
            >
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

export function ProPage({
  title,
  description,
  back,
  action,
  children
}: {
  title: string
  description: string
  back?: { href: string; label: string }
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="pro-page">
      {back && (
        <Link href={back.href} className="pro-back">
          <ArrowLeft size={17} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <PageIntro title={title} description={description} action={action} className="pro-intro" />
      {children}
    </section>
  )
}

export function ProPanel({
  title,
  description,
  action,
  children,
  className
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('pro-panel', className)}>
      <div className="pro-panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p className="pro-muted mt-1">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ProShortcut({
  href,
  title,
  description,
  icon: Icon
}: {
  href: string
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <Link href={href} className="pro-shortcut">
      <span className="pro-icon">
        <Icon size={21} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong>{title}</strong>
        <span className="pro-muted block mt-1">{description}</span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
    </Link>
  )
}

export function ProSearch({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="pro-search">
      <Search size={19} aria-hidden="true" />
      <Input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function ProFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="pro-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

type Draft = Record<string, string | boolean>
export function useProDraft<T extends Draft>(key: string, initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [feedback, setFeedback] = useState<{
    state: 'idle' | 'success' | 'error'
    message?: string
  }>({ state: 'idle' })
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(`lysto:pro:${key}`) ?? 'null')
      if (saved && typeof saved === 'object') {
        setValues(
          (current) =>
            Object.fromEntries(
              Object.entries(current).map(([name, value]) => {
                const incoming = (saved as Draft)[name]
                return [name, typeof incoming === typeof value ? incoming : value]
              })
            ) as T
        )
      }
    } catch {
      setFeedback({
        state: 'error',
        message: 'No pudimos recuperar el borrador. Podés volver a completar los datos.'
      })
    }
  }, [key])
  function save() {
    try {
      sessionStorage.setItem(`lysto:pro:${key}`, JSON.stringify(values))
      setFeedback({
        state: 'success',
        message: 'Borrador guardado en esta pestaña. No se envió ni modificó información real.'
      })
    } catch {
      setFeedback({
        state: 'error',
        message: 'No se pudo guardar en este navegador. Conservá los datos antes de salir.'
      })
    }
  }
  return {
    values,
    setValues: (next: T) => {
      setValues(next)
      setFeedback({ state: 'idle' })
    },
    save,
    feedback
  }
}

export function DraftFeedback({
  feedback
}: {
  feedback: { state: 'idle' | 'success' | 'error'; message?: string }
}) {
  return <FormFeedback {...feedback} />
}
