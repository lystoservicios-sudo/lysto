import type { Metadata } from 'next'
import Link from 'next/link'
import { AirVent, ArrowUpRight, MapPin, Sparkles, Wrench } from 'lucide-react'
import { PublicShell } from '@/components/layout/page-shell'
import { ClosingCta, FaqSection, RequestLink, TrustLine } from '@/components/marketing/shared'
import { HomeScene } from '@/components/marketing/home-scene'
import { AirStory } from '@/components/marketing/air-story'
import { HomeTrust, HomeCare } from '@/components/marketing/home-trust'
import { HomeMethod } from '@/components/marketing/home-method'

export const metadata: Metadata = {
  title: 'Lysto | Tu casa, en buenas manos',
  description: 'Mantenimiento del hogar con nuestro equipo de especialistas aprobados, precios claros y seguimiento. Reparación, mantenimiento e instalación de aire acondicionado en Buenos Aires.',
  openGraph: { title: 'Lysto | Tu casa, en buenas manos', description: 'Cuidamos tu hogar con nuestro equipo aprobado. Precios claros, calificaciones y una empresa que te acompaña.', images: [{ url: '/images/lysto-home.webp', width: 1000, height: 1000, alt: 'Tu hogar, en buenas manos con Lysto' }], locale: 'es_AR', type: 'website' }
}

export default function HomePage() {
  return <PublicShell><main>
    <section className="m-container m-hero">
      <div className="m-hero-copy"><h1>Tu casa,<br className="m-hero-break"/> en<br className="m-hero-break"/> <span>buenas manos.</span></h1><p className="m-hero-intro">Nos ocupamos del mantenimiento de tu hogar con nuestro equipo de especialistas. Vos seguís con tu día.</p><div className="m-actions"><RequestLink/><Link href="/solucion#como-funciona" className="m-text-link">Conocé cómo funciona <ArrowUpRight size={16} aria-hidden="true"/></Link></div><TrustLine/></div>
      <div className="m-hero-visual"><HomeScene/></div><div className="m-hero-note"><i aria-hidden="true"/> Aire acondicionado · Buenos Aires</div>
    </section>
    <div className="m-container m-service-strip" aria-label="Encontrá tu servicio">{[
      { href: 'reparacion', label: 'Reparación', detail: 'Volvé a disfrutar tu comodidad.', icon: Wrench },
      { href: 'mantenimiento', label: 'Mantenimiento', detail: 'Tu equipo, bien todo el año.', icon: Sparkles },
      { href: 'instalacion', label: 'Instalación', detail: 'El clima ideal empieza acá.', icon: AirVent }
    ].map(({href,label,detail,icon: Icon}) => <Link href={`/solucion#${href}`} key={href}><Icon strokeWidth={1.5} aria-hidden="true"/><div><strong>{label}</strong><small>{detail}</small></div><ArrowUpRight className="m-strip-arrow" aria-hidden="true"/></Link>)}</div>
    <section className="m-container m-home-intro" aria-labelledby="home-value-title">
      <div><span className="m-small-label">Tu tranquilidad es parte del servicio.</span><h2 id="home-value-title">Cuidamos tu casa.<br/><span>Y la confianza que nos das.</span></h2></div>
      <div><p>Tu hogar es donde descansás, compartís y hacés tu vida. Cuando necesita un arreglo, también necesitás saber a quién le estás abriendo la puerta.</p><p>En Lysto elegimos y aprobamos a las personas que trabajan con nuestro equipo. Sumamos personal calificado, precios claros y seguimiento para que el mantenimiento de tu casa tenga un respaldo de principio a fin.</p><Link className="m-text-link" href="/nosotros">Conocé qué hay detrás de Lysto <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
    </section>
    <HomeTrust/>
    <AirStory/>
    <HomeCare/>
    <HomeMethod/>
    <section className="m-container m-process" id="como-funciona"><h2>Un problema menos.<br className="m-only-mobile"/> <span>Así de simple.</span></h2><div className="m-process-grid">{[
      ['Contanos qué necesitás', 'Elegí el servicio y contanos qué pasa. Te guiamos paso a paso, desde tu celular.'],
      ['Coordinamos el servicio', 'Revisá la propuesta, elegí disponibilidad y conocé al profesional asignado.'],
      ['Disfrutá tu hogar', 'Seguí cada avance y guardá el trabajo realizado. Lysto te acompaña también después.']
    ].map(([title,text],index) => <article className="m-process-step" key={title}><span className="m-step-number">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

    <section className="m-container m-coverage"><div><span className="m-small-label">Cerca de tu casa.</span><h2>Empezamos<br/>en Buenos Aires.</h2><p>Contanos dónde necesitás el servicio. Confirmamos la cobertura y disponibilidad para tu domicilio al hacer la solicitud.</p><Link href="/contacto" className="m-text-link">Consultar por mi zona <ArrowUpRight size={17} aria-hidden="true"/></Link></div><div className="m-coverage-visual"><div className="m-coverage-rings" aria-hidden="true"/><div className="m-coverage-place"><MapPin strokeWidth={1.5} aria-hidden="true"/><div><strong>Buenos Aires</strong><span>Tu próximo servicio, más cerca.</span></div></div></div></section>
    <FaqSection/><ClosingCta/>
  </main></PublicShell>
}
