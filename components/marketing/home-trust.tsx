import Link from 'next/link'
import { ArrowUpRight, CalendarDays, ClipboardList, MessageCircle, ShieldCheck, Star } from 'lucide-react'
import { RequestLink } from './shared'
import './home-trust.css'

const trustSteps = [
  {
    title: 'Seleccionamos a nuestro equipo.',
    description: 'Personal calificado y especializado, aprobado por Lysto para trabajar con nosotros. Sabemos a quién le confiamos el cuidado de tu hogar.'
  },
  {
    title: 'Conocés a quien va a llegar.',
    description: 'Antes de la visita podés consultar quién está asignado a tu servicio. Abrís la puerta con información sobre la persona que va a hacer el trabajo.'
  },
  {
    title: 'El precio se acuerda con vos.',
    description: 'Revisás el alcance y el presupuesto antes de avanzar. Si aparece una necesidad adicional, te la explicamos y pedimos tu aprobación.'
  },
  {
    title: 'Lysto sigue acompañándote.',
    description: 'Coordinamos el servicio y hacemos seguimiento del trabajo. Si necesitás ayuda después de la visita, tenés a nuestro equipo para consultar.'
  }
]

export function HomeTrust() {
  return (
    <section className="m-home-trust" id="confianza" aria-labelledby="home-trust-title">
      <div className="m-container">
        <div className="m-home-trust-grid">
          <div className="m-home-trust-copy">
            <span className="m-home-trust-label"><ShieldCheck size={20} aria-hidden="true" /> El equipo detrás de tu tranquilidad</span>
            <h2 id="home-trust-title">La confianza empieza <span>antes de abrir la puerta.</span></h2>
            <p>Tu casa es tu lugar. Y elegir quién entra importa. En Lysto, cada servicio está en manos de personas aprobadas por nosotros, que trabajan con nuestro equipo.</p>
            <p>Nos hacemos cargo de acompañarte en todo el recorrido: desde entender qué necesitás hasta seguir el resultado del trabajo.</p>
            <Link href="/nosotros" className="m-text-link">Conocé quiénes somos <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <ol className="m-home-trust-steps">
            {trustSteps.map(({ title, description }, index) => (
              <li key={title}>
                <span className="m-home-trust-number" aria-hidden="true">0{index + 1}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="m-home-trust-feedback">
          <div className="m-home-trust-feedback-title"><Star size={29} strokeWidth={1.5} aria-hidden="true" /><h3>Tu opinión también <br />cuida el servicio.</h3></div>
          <p>Después de cada trabajo podés calificar la atención y el servicio recibido. Tu experiencia nos ayuda a evaluar la calidad, escuchar lo que podemos mejorar y cuidar el estándar de nuestro equipo.</p>
        </div>
      </div>
    </section>
  )
}

export function HomeCare() {
  return (
    <section className="m-container m-home-care" aria-labelledby="home-care-title">
      <div className="m-home-care-copy">
        <h2 id="home-care-title">El arreglo de hoy.<br /><span>El cuidado de siempre.</span></h2>
        <p>Tu casa necesita cuidado, incluso cuando todo funciona. Atender una falla y ocuparse del mantenimiento son parte de lo mismo: disfrutar tu hogar con tranquilidad.</p>
        <p>Empezamos por tu aire acondicionado. Para repararlo, mantenerlo o instalarlo, tenés un equipo que conoce el servicio y al que podés volver.</p>
        <div className="m-home-care-actions"><RequestLink>Cuidar mi aire</RequestLink><Link href="/solucion" className="m-text-link">Ver los servicios <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      </div>
      <div className="m-home-care-plan">
        <span className="m-home-care-plan-label">Más allá de una visita</span>
        <h3>Que cada cuidado<br />ayude al próximo.</h3>
        <ul>
          <li><CalendarDays size={23} strokeWidth={1.5} aria-hidden="true" /><div><h4>Anticiparte también es cuidar.</h4><p>El mantenimiento permite revisar cómo está el equipo y detectar necesidades antes de la próxima temporada.</p></div></li>
          <li><ClipboardList size={23} strokeWidth={1.5} aria-hidden="true" /><div><h4>Tener el historial a mano.</h4><p>Los trabajos y las recomendaciones quedan en tu cuenta, para consultar qué se hizo y qué conviene seguir cuidando.</p></div></li>
          <li><MessageCircle size={23} strokeWidth={1.5} aria-hidden="true" /><div><h4>Volver a un equipo conocido.</h4><p>Cuando surja otra necesidad, podés volver a Lysto. La próxima conversación empieza con el recorrido de tu equipo.</p></div></li>
        </ul>
      </div>
    </section>
  )
}
