import Link from 'next/link'
import { ArrowUpRight, Check, ClipboardList, Headphones, House, MessageCircle, RefreshCw, Users, Wrench } from 'lucide-react'
import './about-content.css'

export function AboutTeam() {
  return <section className="m-about-team" aria-labelledby="about-team-title"><div className="m-container m-about-team-grid">
    <div><span className="m-small-label">Personas preparadas. Un método compartido.</span><h2 id="about-team-title">Distintas tareas.<br/><span>Una misma responsabilidad.</span></h2><p>El servicio empieza antes de que llegue el especialista y continúa después de que se va. Por eso, el trabajo técnico y el acompañamiento tienen que estar conectados.</p><p>En Lysto seleccionamos a las personas que trabajan con nosotros y coordinamos el servicio como equipo. Tenés una empresa a la que dirigirte durante todo el recorrido.</p><Link href="/solucion#metodo" className="m-text-link">Conocé nuestra forma de trabajar <ArrowUpRight size={17} aria-hidden="true"/></Link></div>
    <div className="m-about-team-map"><div className="m-about-team-home"><span><House size={29} strokeWidth={1.4} aria-hidden="true"/></span><div><strong>Tu hogar, en el centro.</strong><p>El equipo de Lysto, alrededor.</p></div></div><ul>{[
      { icon: ClipboardList, title: 'Coordinamos', text: 'Entendemos tu necesidad, organizamos la visita y te ayudamos con los pasos del servicio.' },
      { icon: Wrench, title: 'Resolvemos', text: 'Nuestros especialistas revisan el equipo, proponen el trabajo y llevan adelante lo que aprobaste.' },
      { icon: Headphones, title: 'Acompañamos', text: 'Recibimos tu consulta y tu calificación, y seguimos siendo tu punto de contacto después de la visita.' },
    ].map(({ icon: Icon, title, text }) => <li key={title}><span className="m-about-team-node"><Icon size={21} strokeWidth={1.6} aria-hidden="true"/></span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ul></div>
  </div></section>
}

export function AboutLearning() {
  return <>
    <section className="m-container m-about-learning" aria-labelledby="about-learning-title"><div className="m-about-learning-heading"><div><span className="m-small-label">Aprender también es parte del trabajo.</span><h2 id="about-learning-title">Cada hogar nos ayuda<br/><span>a hacerlo mejor.</span></h2></div><p>Una buena experiencia se construye escuchando, revisando y mejorando. Esa es la cultura que queremos hacer crecer con cada servicio.</p></div><div className="m-about-learning-grid">{[
      { icon: MessageCircle, title: 'Escuchar lo que viviste.', text: 'Tu calificación y tus comentarios nos ayudan a entender qué salió bien y qué necesita atención. Detrás de cada opinión hay una experiencia que vale la pena revisar.' },
      { icon: RefreshCw, title: 'Revisar cómo trabajamos.', text: 'Aprender de cada visita permite ajustar la coordinación, aclarar la información y mejorar nuestros procedimientos. El objetivo es que el próximo servicio sea más claro y ordenado.' },
      { icon: Users, title: 'Compartir lo aprendido.', text: 'La preparación del equipo no termina al incorporarse. Buscamos que la capacitación, las guías de trabajo y el intercambio de experiencia acompañen el crecimiento de Lysto.' },
    ].map(({ icon: Icon, title, text }) => <article key={title}><Icon size={27} strokeWidth={1.5} aria-hidden="true"/><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="m-container m-about-direction" aria-labelledby="about-direction-title"><div><span className="m-about-direction-label">Nuestro próximo paso empieza acá.</span><h2 id="about-direction-title">Crecer, sin perder<br/>el cuidado.</h2><p>Hoy empezamos con aire acondicionado en Buenos Aires. Queremos llegar a más hogares, sumando personas preparadas y procesos que puedan sostener la calidad del servicio.</p><p>La dirección es simple: hogares más cómodos, personas más tranquilas y una relación que dure más que un arreglo.</p><Link href="/contacto" className="m-text-link">Conversemos <ArrowUpRight size={17} aria-hidden="true"/></Link></div><div className="m-about-direction-mark" aria-hidden="true"><House strokeWidth={1}/><span><Check strokeWidth={2}/></span></div></section>
  </>
}
