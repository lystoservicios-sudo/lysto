import { Award, Star, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { CustomerProfessionalRecognitionViewModel } from '@/features/customer/view-models'

export function ProfessionalRecognitionCard({ recognition }: { recognition: CustomerProfessionalRecognitionViewModel }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Award aria-hidden="true" className="h-5 w-5" /></div>
        <Badge tone={recognition.verified ? 'green' : 'slate'}>{recognition.verified ? 'Profesional verificado' : 'Perfil de demostración'}</Badge>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Reconocimiento</p>
      <h3 className="mt-1 text-lg font-black text-slate-950">{recognition.recognitionLabel}</h3>
      <p className="mt-2 font-bold text-slate-800">{recognition.professionalName}</p>
      <p className="mt-1 text-sm text-slate-600">{recognition.specialty}</p>
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-slate-100">
        <div className="bg-slate-50 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Star aria-hidden="true" className="h-4 w-4" />Calificación</p><p className="mt-1 text-lg font-black tabular-nums text-slate-950">{recognition.rating.toFixed(1)}</p></div>
        <div className="bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Aceptación</p><p className="mt-1 text-lg font-black tabular-nums text-slate-950">{recognition.acceptanceRate}%</p></div>
        <div className="bg-slate-50 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Wrench aria-hidden="true" className="h-4 w-4" />Servicios</p><p className="mt-1 text-lg font-black tabular-nums text-slate-950">{recognition.completedServices}</p></div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{recognition.summary}</p>
    </article>
  )
}
