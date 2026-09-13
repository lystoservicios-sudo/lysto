import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { AirVent, ArrowRight, Check, ShieldCheck, Sparkles, Wrench } from 'lucide-react'
import { PublicShell } from '@/components/layout/page-shell'
import { ClosingCta, FaqSection, RequestLink, requestHref } from '@/components/marketing/shared'
import { SolutionDetails, VisitPreparation } from '@/components/marketing/solution-content'
import '@/components/marketing/solution-content.css'

export const metadata: Metadata = { title: 'Nuestra solución | Lysto', description: 'Reparación, mantenimiento e instalación de aire acondicionado en Buenos Aires con nuestro equipo aprobado. Diagnóstico, precios claros y seguimiento de Lysto.' }
const services = [
  { id: 'reparacion', title: 'Que vuelva a funcionar.', name: 'Reparación', icon: Wrench, text: '¿No enfría, pierde agua o hace un ruido raro? Un especialista de nuestro equipo revisa el problema para definir la solución adecuada.', items: ['Orientación inicial sobre el problema', 'Diagnóstico técnico en tu domicilio', 'Presupuesto antes de avanzar'] },
  { id: 'mantenimiento', title: 'Cuidarlo también es disfrutarlo.', name: 'Mantenimiento', icon: Sparkles, text: 'Un equipo cuidado funciona mejor. Mantené tu aire en condiciones y anticipate a los problemas de la próxima temporada.', items: ['Limpieza y revisión del equipo', 'Recomendaciones de cuidado', 'Historial para el próximo servicio'] },
  { id: 'instalacion', title: 'Bien instalado. Desde el inicio.', name: 'Instalación', icon: AirVent, text: 'Estrená tu aire con una instalación pensada para tu espacio. Coordinamos los detalles para que vos solo pienses en estar cómodo.', items: ['Revisión de las condiciones del lugar', 'Alcance y materiales informados', 'Instalación y puesta en marcha'] }
]

export default function SolutionPage() {
  return <PublicShell><main>
    <section className="m-container m-page-hero m-sol-hero"><div><span className="m-small-label">Nuestro equipo cuida tu hogar</span><h1>Tu aire, a punto.<br/><span>Tu día, intacto.</span></h1><p>Reparamos, mantenemos e instalamos tu aire acondicionado con especialistas aprobados por Lysto que trabajan con nosotros. Conocés quién viene, revisás el presupuesto y contás con nuestro seguimiento.</p><div className="m-actions"><RequestLink/><Link href="#servicios" className="m-text-link">Encontrar mi servicio <ArrowRight size={17} aria-hidden="true"/></Link></div></div><div className="m-sol-art m-sol-art-work"><Image src="/images/service-care.webp" alt="Ilustración de un aire acondicionado con instrumentos de diagnóstico y herramientas de cuidado profesional" width={1100} height={1100} sizes="(max-width:760px) 90vw, 45vw" priority/><span className="m-art-label"><ShieldCheck size={18} aria-hidden="true"/> Preparados para cuidar tu equipo.</span></div></section>
    <nav className="m-container m-service-jump" id="servicios" aria-label="Elegí el servicio que necesitás"><span>¿Qué necesita tu aire?</span><Link href="#reparacion">Resolver una falla <ArrowRight size={16} aria-hidden="true"/></Link><Link href="#mantenimiento">Hacer un mantenimiento <ArrowRight size={16} aria-hidden="true"/></Link><Link href="#instalacion">Instalar un equipo <ArrowRight size={16} aria-hidden="true"/></Link></nav>
    <section className="m-container" aria-label="Servicios de aire acondicionado">{services.map(({ id, title, name, icon: Icon, text, items }) => <article className="m-service-detail" id={id} key={id}><div className="m-service-icon"><Icon aria-hidden="true"/></div><div><span className="m-small-label">{name}</span><h2>{title}</h2><p>{text}</p></div><div><ul className="m-service-list">{items.map(item => <li key={item}><Check size={18} aria-hidden="true"/>{item}</li>)}</ul><Link href={requestHref} className="m-text-link">Pedir {name.toLowerCase()} <ArrowRight size={18} aria-hidden="true"/></Link></div></article>)}</section>
    <SolutionDetails/>
    <section className="m-solution-process" id="como-funciona"><div className="m-container"><span className="m-small-label">Vos tenés un plan. Nosotros también.</span><h2>Del “no funciona”<br/>al “ya está Lysto”.</h2><div className="m-solution-timeline">{[
      ['01', 'Contanos qué pasa', 'Creá tu cuenta, elegí el servicio y contanos sobre tu equipo. Podés sumar fotos para orientarnos mejor.'],
      ['02', 'Elegí con claridad', 'Completá el domicilio, consultá disponibilidad y revisá la propuesta antes de confirmar.'],
      ['03', 'Recibí a nuestro especialista', 'Conocé a la persona de nuestro equipo asignada a tu servicio y seguí los avances. Lysto acompaña la visita de principio a fin.'],
      ['04', 'Contanos cómo salió', 'El trabajo y sus recomendaciones quedan registrados. Calificá tu experiencia y contá con nosotros para continuar cuidando tu equipo.']
    ].map(([number,title,text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    <VisitPreparation/><FaqSection/><ClosingCta/>
  </main></PublicShell>
}
