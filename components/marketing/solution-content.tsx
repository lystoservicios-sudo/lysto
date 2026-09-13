import Link from 'next/link'
import { ArrowUpRight, Check, ClipboardCheck, Eye, Gauge, ScanLine, ShieldCheck } from 'lucide-react'
import { RequestLink } from './shared'

const symptoms = [
  { title: 'El aire prende, pero no enfría.', description: 'El equipo funciona, aunque el ambiente no se siente más fresco. Puede haber distintas causas; describir el síntoma nos ayuda a empezar.', review: 'Revisamos la configuración, el paso del aire y el funcionamiento del conjunto. Las mediciones permiten orientar el diagnóstico.' },
  { title: 'Enfría menos de lo que debería.', description: 'Sale aire fresco, pero no alcanza para estar cómodo. El estado del equipo y las condiciones del ambiente pueden influir.', review: 'Observamos filtros, circulación de aire y condiciones de las unidades, junto con las características del espacio.' },
  { title: 'Tarda demasiado en enfriar.', description: 'Llega a enfriar, pero necesita más tiempo que antes. Saber cuándo empezó y en qué momentos ocurre aporta información útil.', review: 'Evaluamos el rendimiento del equipo, su mantenimiento y la relación entre su capacidad y el ambiente.' },
  { title: 'La temperatura cambia o no llega a la elegida.', description: 'El ambiente se enfría de manera irregular o no alcanza la temperatura seleccionada. Contanos qué notás durante el uso.', review: 'Verificamos controles, sensores y funcionamiento, según lo que muestre la revisión. Una señal por sí sola no define la reparación.' },
] as const

export const careMethod = [
  { icon: Eye, title: 'Observamos', text: 'Escuchamos lo que notaste y revisamos el equipo en su ambiente.' },
  { icon: ShieldCheck, title: 'Verificamos', text: 'Evaluamos las condiciones del lugar y preparamos una intervención ordenada.' },
  { icon: Gauge, title: 'Medimos', text: 'Usamos instrumentos y criterio profesional para entender qué necesita el equipo.' },
  { icon: ClipboardCheck, title: 'Comprobamos', text: 'Revisamos el resultado del trabajo y te explicamos qué se hizo y cómo cuidarlo.' },
] as const

export function SolutionDetails() {
  return <>
    <section className="m-symptoms" aria-labelledby="symptoms-title">
      <div className="m-container m-symptoms-grid">
        <div className="m-symptoms-intro"><span className="m-small-label">Empezamos por lo que vos notás.</span><h2 id="symptoms-title">No tenés que saber<br/><span>qué está fallando.</span></h2><p>Para eso está nuestro equipo. Contanos qué hace tu aire y nosotros nos ocupamos de investigar la causa.</p><p>Estos son algunos problemas de enfriamiento que podés describir al pedir una revisión.</p><Link href="#metodo" className="m-text-link">Así llegamos al diagnóstico <ArrowUpRight size={17} aria-hidden="true"/></Link></div>
        <div className="m-symptom-list">{symptoms.map((symptom, index) => <details key={symptom.title} open={index === 0}><summary><span className="m-symptom-index">0{index + 1}</span><span>{symptom.title}</span><span className="m-symptom-toggle" aria-hidden="true">+</span></summary><div className="m-symptom-answer"><p>{symptom.description}</p><h3>Qué revisa Lysto</h3><p>{symptom.review}</p></div></details>)}<p className="m-symptom-note">Si gotea, hace ruido o presenta otra falla, también podés contárnoslo en tu solicitud. El diagnóstico se confirma con la revisión profesional.</p></div>
      </div>
    </section>
    <section className="m-container m-service-method" id="metodo" aria-labelledby="method-title">
      <div className="m-service-section-heading"><div><span className="m-small-label">El cuidado también está en el proceso.</span><h2 id="method-title">Revisar bien.<br/><span>Resolver con criterio.</span></h2></div><p>Cada visita combina preparación, instrumentos adecuados y la experiencia de nuestro equipo. Seguimos una forma de trabajar que pone atención en los detalles.</p></div>
      <ol className="m-method-grid">{careMethod.map(({ icon: Icon, title, text }, index) => <li key={title}><div className="m-method-mark"><Icon size={28} strokeWidth={1.5} aria-hidden="true"/><span>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></li>)}</ol>
      <div className="m-method-bottom"><ScanLine size={21} aria-hidden="true"/><p>Las comprobaciones se adaptan al equipo, al lugar y a las indicaciones de su fabricante. Te explicamos los hallazgos antes de definir el trabajo.</p></div>
    </section>
    <section className="m-budget-section" aria-labelledby="budget-title"><div className="m-container m-budget-grid">
      <div><span className="m-small-label">Entender también es poder decidir.</span><h2 id="budget-title">Un presupuesto<br/>que podés entender.</h2><p>Queremos que sepas qué estamos proponiendo y por qué. El alcance y el importe se presentan antes de realizar el trabajo correspondiente.</p><p>Si durante la visita aparece una necesidad adicional, te la explicamos y pedimos tu aprobación. Así podés decidir cómo seguir.</p><RequestLink>Pedir una revisión</RequestLink></div>
      <div className="m-budget-sheet"><div className="m-budget-sheet-heading"><ClipboardCheck size={25} strokeWidth={1.5} aria-hidden="true"/><span>Todo claro, antes de avanzar</span></div><ol>{[
        ['Qué encontramos', 'El problema identificado y lo que necesita atención.'],
        ['Qué proponemos hacer', 'El trabajo y su alcance, explicado con claridad.'],
        ['Qué hace falta', 'Los materiales o repuestos necesarios, cuando correspondan.'],
        ['Qué vas a aprobar', 'El detalle del importe y las condiciones de la propuesta.'],
      ].map(([title, text]) => <li key={title}><Check size={18} aria-hidden="true"/><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol><p className="m-budget-sheet-foot">Una propuesta informada. Una decisión tuya.</p></div>
    </div></section>
  </>
}

export function VisitPreparation() {
  return <section className="m-container m-visit-preparation" aria-labelledby="visit-preparation-title"><div><h2 id="visit-preparation-title">Unos pocos datos.<br/><span>Un mejor comienzo.</span></h2><p>No necesitás un diagnóstico previo. Esta información nos ayuda a entender tu consulta y preparar el servicio.</p><Link href="/contacto" className="m-text-link">Tengo una duda antes de empezar <ArrowUpRight size={17} aria-hidden="true"/></Link></div><ul>{[
    ['Qué está pasando', 'Cómo se comporta el aire y desde cuándo lo notás.'],
    ['Qué equipo tenés', 'Marca y modelo, si los tenés a mano. Las fotos también ayudan.'],
    ['Dónde está instalado', 'El tipo de ambiente y cómo se accede a las unidades.'],
    ['Cuándo podés recibirnos', 'Tu domicilio y disponibilidad se completan en la solicitud.'],
  ].map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ul></section>
}
