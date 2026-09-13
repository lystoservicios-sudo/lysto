import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { careMethod } from './solution-content'
import './home-method.css'

export function HomeMethod() {
  return <section className="m-container m-home-method" aria-labelledby="home-method-title"><div className="m-home-method-heading"><div><span className="m-small-label">Detrás de cada arreglo, una forma de trabajar.</span><h2 id="home-method-title">Tu tranquilidad<br/><span>también tiene un método.</span></h2></div><p>La preparación, la revisión y las comprobaciones hacen la diferencia. Nuestro equipo se ocupa de entender qué pasa y explicar cómo resolverlo.</p></div><ol>{careMethod.map(({ icon: Icon, title }, index) => <li key={title}><Icon size={25} strokeWidth={1.5} aria-hidden="true"/><span>0{index + 1}</span><h3>{title}</h3></li>)}</ol><Link href="/solucion#metodo" className="m-text-link">Conocé qué hacemos en cada visita <ArrowUpRight size={17} aria-hidden="true"/></Link></section>
}
