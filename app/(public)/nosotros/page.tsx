import type { Metadata } from 'next'
import Image from 'next/image'
import { ClipboardCheck, GraduationCap, House, ShieldCheck } from 'lucide-react'
import { PublicShell } from '@/components/layout/page-shell'
import { ClosingCta } from '@/components/marketing/shared'
import { AboutTeam, AboutLearning } from '@/components/marketing/about-content'

export const metadata: Metadata = { title: 'Quiénes somos | Lysto', description: 'Cuidamos el mantenimiento de tu hogar con nuestro equipo de especialistas aprobados, precios claros y seguimiento. Conocé cómo construimos confianza en Lysto.' }
export default function AboutPage() {
  return <PublicShell><main>
    <section className="m-container m-page-hero m-about-hero"><div><span className="m-small-label">El propósito que nos mueve</span><h1>Hogares más simples.<br/><span>Vidas más tranquilas.</span></h1></div><p>Cuidamos el mantenimiento de tu hogar para que vos puedas disfrutarlo. Con personas preparadas, una forma de trabajar compartida y la tranquilidad de contar con Lysto.</p></section>
    <section className="m-container m-about-world" aria-label="Nuestra forma de ver el hogar"><div><Image src="/images/lysto-home.webp" alt="Un hogar cuidado, luminoso y cómodo" width={1000} height={1000} priority/><p>Un lugar para estar bien.</p></div><div className="m-about-manifesto"><House aria-hidden="true"/><p>El mejor arreglo<br/>es el que te devuelve<br/>la tranquilidad.</p><span>La idea que mueve a Lysto.</span></div></section>
    <section className="m-container m-about-story"><h2>Tu casa.<br/>Nuestro compromiso.</h2><div><p>Dejar entrar a alguien a tu hogar es una decisión de confianza. Necesitás saber quién viene, si tiene la preparación para hacer el trabajo y a quién recurrir si algo necesita atención. Esa tranquilidad es el centro de Lysto.</p><p>Por eso trabajamos con nuestro equipo de personal calificado y especializado. Seleccionamos y aprobamos a las personas que trabajan con nosotros, coordinamos cada servicio y acompañamos lo que sucede antes, durante y después de la visita.</p><p>Los precios claros, el seguimiento y las calificaciones forman parte de la misma idea: que tengas información para decidir y una empresa con la que contar. Tu experiencia nos permite revisar la calidad y seguir mejorando.</p><p>Nos dedicamos al cuidado y mantenimiento del hogar. Empezamos con aire acondicionado en Buenos Aires, construyendo una relación que pueda continuar mucho más allá de un arreglo.</p></div></section>
    <AboutTeam/>
    <section className="m-values"><div className="m-container"><h2>La calidad empieza<br/>antes de intervenir.</h2><div className="m-values-grid">{[
      { icon: GraduationCap, title: 'Preparación y criterio.', text: 'Seleccionamos personal calificado y especializado. Las guías y la formación acompañan su experiencia para evaluar cada equipo y cada situación.' },
      { icon: ShieldCheck, title: 'Un trabajo ordenado.', text: 'Revisar las condiciones, preparar los instrumentos y cuidar el lugar son parte del servicio. Los procedimientos se adaptan al equipo y a las indicaciones del fabricante.' },
      { icon: ClipboardCheck, title: 'Comprobar y explicar.', text: 'Observar, verificar y medir ayuda a tomar decisiones informadas. Revisamos el resultado y te explicamos el trabajo realizado y las recomendaciones de cuidado.' }
    ].map(({icon: Icon,title,text}) => <article key={title}><Icon aria-hidden="true"/><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    <AboutLearning/><ClosingCta/>
  </main></PublicShell>
}
