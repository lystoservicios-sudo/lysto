import { ClipboardList, CreditCard, FileCheck2, Wrench } from 'lucide-react'

const steps = [
  { id: 'budget', icon: ClipboardList, title: 'Presupuesto', description: 'Revisás el importe antes de cualquier operación.' },
  { id: 'payment', icon: CreditCard, title: 'Pago protegido', description: 'La pasarela confirma el resultado en el servidor.' },
  { id: 'service', icon: Wrench, title: 'Servicio', description: 'La solicitud avanza sólo después de una confirmación válida.' },
  { id: 'receipt', icon: FileCheck2, title: 'Comprobante y garantía', description: 'El cierre conserva referencias seguras y trazables.' }
] as const

export function PaymentProcessStrip() {
  return (
    <section aria-labelledby="payment-process-title" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Cómo funcionará</p>
      <h2 id="payment-process-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Del presupuesto al respaldo</h2>
      <ol aria-label="Proceso de pago y respaldo" className="mt-5 grid gap-3 md:grid-cols-4">
        {steps.map(({ id, icon: Icon, title, description }, index) => (
          <li key={id} className="relative rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-blue-700 ring-1 ring-slate-200"><Icon aria-hidden="true" className="h-5 w-5" /></span><span className="text-xs font-black tabular-nums text-slate-400">0{index + 1}</span></div>
            <p className="mt-4 font-black text-slate-950">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
