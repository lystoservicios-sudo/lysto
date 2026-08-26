import { ClipboardCheck, Info } from 'lucide-react'

import { Card } from '@/components/ui/card'

export function PreliminaryDiagnosisPanel({ summary }: { summary: string }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
          <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Orientación previa</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Diagnóstico preliminar</h2>
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-700">{summary}</p>
      <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <p>Es una orientación basada en tus respuestas. El profesional debe confirmarla durante la visita.</p>
      </div>
    </Card>
  )
}
