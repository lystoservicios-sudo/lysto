import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Check, House, ShieldCheck, Wind } from 'lucide-react'
import { PublicShell } from '@/components/layout/page-shell'
import './auth.css'

export function AuthFrame({ eyebrow, title, description, children, variant = 'customer' }: { eyebrow?: string; title: string; description: string; children: ReactNode; variant?: 'customer' | 'staff' }) {
  if (variant === 'customer') return <div className="auth-customer">
    <a className="auth-skip-link" href="#auth-content">Saltar al formulario</a>
    <header className="auth-masthead">
      <div className="auth-masthead-inner">
        <div className="auth-identity">
          <Link href="/" className="auth-brand" aria-label="Lysto, volver al inicio">lysto<span>.</span></Link>
          <p>Tu hogar, conectado.</p>
        </div>
        <Image className="auth-room" src="/images/room-architecture.webp" alt="" width={256} height={256} priority sizes="(max-width: 600px) 200px, 240px" />
      </div>
    </header>
    <main id="auth-content" className="auth-panel" tabIndex={-1}>
      {eyebrow && <p className="auth-context">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="auth-intro">{description}</p>}
      {children}
    </main>
  </div>

  return <PublicShell><main className="auth-page">
    <aside className="auth-story">
      <span className="auth-eyebrow">MÁS TIEMPO PARA VOS.</span>
      <h2>Que tu casa<br />funcione.<br /><em>Y vos, disfrutá.</em></h2>
      <p>Encontrá la solución para tu hogar y seguí cada paso desde un solo lugar.</p>
      <div className="auth-illustration" aria-hidden="true">
        <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
        <div className="auth-house"><House strokeWidth={1.1} /><div className="auth-house-window" /></div>
        <div className="auth-float auth-float-service"><Wind /><span>Aire acondicionado<br /><strong>Todo bajo control</strong></span><Check /></div>
        <div className="auth-float auth-float-check"><ShieldCheck /><span>Profesionales<br /><strong>verificados</strong></span></div>
      </div>
      <div className="auth-story-bottom"><span>Tu hogar. Tu tranquilidad.</span><ArrowUpRight size={22} /></div>
    </aside>
    <section className="auth-panel">
      <span className="auth-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="auth-intro">{description}</p>
      {children}
      <p className="auth-trust"><ShieldCheck size={15} aria-hidden="true" /> Tus datos, siempre protegidos.</p>
    </section>
  </main></PublicShell>
}
