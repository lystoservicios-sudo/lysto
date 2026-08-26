import { Droplets, Gauge, ShieldCheck } from 'lucide-react'

const benefits = [
  { icon: Gauge, title: 'Conserva el rendimiento', description: 'Filtros y serpentinas limpios ayudan al equipo a trabajar con menos esfuerzo.' },
  { icon: Droplets, title: 'Previene pérdidas', description: 'Revisar drenaje y bandeja reduce obstrucciones y goteos inesperados.' },
  { icon: ShieldCheck, title: 'Deja trazabilidad', description: 'Cada cierre técnico suma información útil para la próxima visita.' }
]

export function EducationBenefitPanel() {
  return (
    <section aria-labelledby="maintenance-education-title" className="rounded-3xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Cuidado preventivo</p>
      <h2 id="maintenance-education-title" className="mt-2 text-2xl font-black tracking-tight text-blue-950">Cuidar el equipo también es parte del servicio</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900/80">Las recomendaciones surgen del último parte técnico. Son una guía para decidir, no una cita agendada automáticamente.</p>
      <ul className="mt-5 grid gap-3 md:grid-cols-3">
        {benefits.map(({ icon: Icon, title, description }) => (
          <li key={title} className="rounded-2xl bg-white/80 p-4">
            <Icon aria-hidden="true" className="h-5 w-5 text-blue-700" />
            <p className="mt-3 font-black text-slate-950">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
