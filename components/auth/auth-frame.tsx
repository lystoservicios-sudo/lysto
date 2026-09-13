import type { ReactNode } from 'react'
import { ArrowUpRight, Check, House, ShieldCheck, Wind } from 'lucide-react'
import { PublicShell } from '@/components/layout/page-shell'
import './auth.css'

export function AuthFrame({ eyebrow = 'TU HOGAR, EN BUENAS MANOS', title, description, children }: { eyebrow?: string; title: string; description: string; children: ReactNode }) {
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
