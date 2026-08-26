import { ArrowRight, FileSearch, Stethoscope } from 'lucide-react'

import { Card } from '@/components/ui/card'

const currencyFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export function DiagnosisComparison({ preliminaryDiagnosis, professionalDiagnosis, preliminaryAmount, finalAmount, priceChangeReason }: {
  preliminaryDiagnosis?: string
  professionalDiagnosis?: string
  preliminaryAmount?: number | null
  finalAmount?: number | null
  priceChangeReason?: string
}) {
  if (!preliminaryDiagnosis && !professionalDiagnosis) return null

  const hasPriceChange = preliminaryAmount != null && finalAmount != null && preliminaryAmount !== finalAmount
  const difference = hasPriceChange ? finalAmount - preliminaryAmount : 0

  return (
    <Card className="shadow-none">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700"><FileSearch aria-hidden="true" className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Transparencia técnica</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Cómo cambió el diagnóstico</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <DiagnosisSource label="Orientación inicial" moment="Antes de la visita" text={preliminaryDiagnosis ?? 'No disponible'} amount={preliminaryAmount} />
        <div className="hidden items-center text-slate-400 md:flex"><ArrowRight aria-hidden="true" className="h-5 w-5" /></div>
        <DiagnosisSource label="Diagnóstico profesional" moment="Durante la visita" text={professionalDiagnosis ?? 'Pendiente'} amount={finalAmount} professional />
      </div>

      {hasPriceChange ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-black">
            <span className="block">El presupuesto {difference > 0 ? 'aumentó' : 'disminuyó'}</span>
            <span className="mt-1 block text-xl tabular-nums">{currencyFormatter.format(Math.abs(difference))}</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-900/80">{priceChangeReason ?? 'El profesional debe informar el motivo antes de solicitar aprobación.'}</p>
        </div>
      ) : null}
    </Card>
  )
}

function DiagnosisSource({ label, moment, text, amount, professional = false }: {
  label: string
  moment: string
  text: string
  amount?: number | null
  professional?: boolean
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">{professional ? <Stethoscope aria-hidden="true" className="h-4 w-4" /> : null}{label}</p>
      <p className="mt-1 text-xs text-slate-500">{moment}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{text}</p>
      {amount != null ? <p className="mt-3 text-lg font-black tabular-nums text-slate-950">{currencyFormatter.format(amount)}</p> : null}
    </div>
  )
}
