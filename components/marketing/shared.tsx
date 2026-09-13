import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, MapPin, ShieldCheck } from 'lucide-react'
import { Brand } from './brand'
import type { ReactNode } from 'react'

export const requestHref = '/login?next=%2Fapp%2Fsolicitar%2Faire-acondicionado'
export function RequestLink({ children = 'Pedir un servicio', light = false, className = '' }: { children?: ReactNode; light?: boolean; className?: string }) {
  return <Link href={requestHref} className={`m-button ${light ? 'm-button-lime' : 'm-button-blue'} ${className}`}>{children}<ArrowRight size={20} aria-hidden="true" /></Link>
}
export function TrustLine() { return <p className="m-trust"><ShieldCheck size={22} aria-hidden="true"/><span>Equipo aprobado por Lysto. Precios claros.</span></p> }
export function ClosingCta() {
  return <section className="m-container m-closing"><div><span className="m-small-label">Quedate con lo lindo de estar en casa.</span><h2>Del resto,<br/>nos ocupamos.</h2><RequestLink light /></div><div className="m-closing-symbol" aria-hidden="true"><Check strokeWidth={1.8}/></div><p>Simple. Acompañado.<br/>Así de Lysto.</p></section>
}
export const faqs = [
  ['¿Qué servicios puedo pedir?', 'Por ahora nos enfocamos en reparación, mantenimiento e instalación de aires acondicionados. Contanos qué necesitás y te acompañamos para encontrar el servicio adecuado.'],
  ['¿Cómo sé cuánto voy a pagar?', 'Antes de confirmar vas a ver la propuesta y el detalle del servicio. Si durante la visita surge un trabajo adicional, el profesional debe informarlo y pedir tu aprobación antes de realizarlo.'],
  ['¿Quién viene a mi casa?', 'Un especialista de nuestro equipo, seleccionado y aprobado por Lysto. Son personas que trabajan con nosotros y con nuestra forma de cuidar tu hogar. Antes de la visita podés conocer quién fue asignado y consultar sus datos desde tu cuenta.'],
  ['¿Lysto solo me conecta con un técnico?', 'Nos ocupamos de organizar el servicio con nuestro equipo de profesionales aprobados. Coordinamos la visita, acompañamos el trabajo y seguimos siendo tu punto de contacto después. La responsabilidad de cuidar tu experiencia es parte de lo que ofrecemos.'],
  ['¿Para qué sirven las calificaciones?', 'Después del servicio podés calificar la atención y el trabajo recibido. Tu experiencia nos ayuda a dar seguimiento a la calidad, reconocer un buen servicio y detectar aspectos que requieren revisión.'],
  ['¿En qué zonas trabajan?', 'Nuestro alcance inicial está en Buenos Aires. La disponibilidad se confirma según tu domicilio y el tipo de servicio al hacer la solicitud.'],
  ['¿Qué pasa después de la visita?', 'El trabajo queda registrado en tu cuenta, junto con su comprobante y las recomendaciones para cuidar el equipo. Podés calificar el servicio y volver a contactarnos si necesitás ayuda. Queremos acompañar el mantenimiento de tu hogar también después del arreglo.']
] as const
export function FaqSection() { return <section className="m-container m-faq" id="preguntas"><div><span className="m-small-label">Todo claro, desde el principio</span><h2>Es bueno <br/>sacarse las dudas.</h2><Link className="m-text-link" href="/contacto">Hablemos <ArrowUpRight size={18} aria-hidden="true"/></Link></div><div className="m-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section> }
export function MarketingFooter() {
  return <footer className="m-footer"><div className="m-container"><div className="m-footer-main"><div><Link href="/" aria-label="Lysto, inicio"><Brand/></Link><p>Tu hogar funciona.<br/>Vos disfrutás.</p><span className="m-footer-location"><MapPin size={16} aria-hidden="true"/> Buenos Aires, Argentina</span></div><nav aria-label="Explorá Lysto"><strong>Conocé Lysto</strong><Link href="/solucion">Nuestra solución</Link><Link href="/nosotros">Quiénes somos</Link><Link href="/contacto">Hablemos</Link></nav><nav aria-label="Tus servicios"><strong>Tu casa, al día</strong><Link href="/solucion#reparacion">Reparación</Link><Link href="/solucion#mantenimiento">Mantenimiento</Link><Link href="/solucion#instalacion">Instalación</Link><Link href="/login">Mi cuenta <ArrowUpRight size={13} aria-hidden="true"/></Link></nav><div className="m-footer-note"><ShieldCheck size={28} aria-hidden="true"/><p>Un solo lugar.<br/>Todo el acompañamiento.</p></div></div><div className="m-footer-bottom"><span>© {new Date().getFullYear()} Lysto. Hecho para tu tranquilidad.</span><nav aria-label="Información legal"><Link href="/terminos">Términos</Link><Link href="/privacidad">Privacidad</Link><Link href="/cancelaciones">Cancelaciones</Link><Link href="/ayuda">Ayuda</Link></nav><a className="m-footer-credit" href="https://kazecode.com.ar" target="_blank" rel="noreferrer">Hecho por Kazecode <ArrowUpRight size={12} aria-hidden="true"/></a></div></div></footer>
}
