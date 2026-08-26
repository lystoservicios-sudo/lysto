import { ClipboardCheck, Route, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BenefitStrip, type BenefitStripItem } from './benefit-strip'

const defaultBenefits: BenefitStripItem[] = [
  { id: 'documented', title: 'Cobertura documentada', description: 'Cada respaldo se vincula con el equipo y el cierre técnico.', icon: <ClipboardCheck aria-hidden="true" className="h-5 w-5" /> },
  { id: 'traceable', title: 'Seguimiento comprensible', description: 'Ves el estado, el próximo paso y la resolución sin notas internas.', icon: <Route aria-hidden="true" className="h-5 w-5" /> },
  { id: 'quality', title: 'Control de calidad', description: 'Lysto acompaña los casos que necesitan una revisión posterior.', icon: <ShieldCheck aria-hidden="true" className="h-5 w-5" /> }
]

export function WarrantyAssurancePanel({ onReportProblem, benefits = defaultBenefits }: {
  onReportProblem?: () => void
  benefits?: readonly BenefitStripItem[]
}) {
  const available = Boolean(onReportProblem)

  return (
    <section aria-labelledby="warranty-assurance-title" className="rounded-3xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Cadena de respaldo Lysto</p>
          <h2 id="warranty-assurance-title" className="mt-2 text-2xl font-black tracking-tight text-blue-950 sm:text-3xl">Tu servicio sigue respaldado después de la visita</h2>
          <p className="mt-2 text-sm leading-6 text-blue-900/80">Consultá coberturas, reclamos y seguimientos de calidad desde un único lugar. Los estados visibles provienen de registros confirmados.</p>
        </div>
        <div className="shrink-0 lg:w-64">
          <Button type="button" className="w-full" disabled={!available} onClick={onReportProblem}>Informar un problema</Button>
          {!available ? <p className="mt-2 text-center text-xs font-semibold leading-5 text-blue-900/70">La apertura de reclamos se habilitará cuando exista una operación conectada.</p> : null}
        </div>
      </div>
      <BenefitStrip items={benefits} className="mt-5" />
    </section>
  )
}
