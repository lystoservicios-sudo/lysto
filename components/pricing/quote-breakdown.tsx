import { Card } from '@/components/ui/card'
import { reviewReasonLabels, type ServiceQuote } from '@/lib/pricing/service-quote'
import { quotePresentation } from '@/lib/pricing/quote-presentation'
const ars = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
export function QuoteBreakdown({ quote, internal = false, status }: { quote: ServiceQuote; internal?: boolean; status?: string }) {
  const q = quotePresentation(quote)
  const reviewed = status === 'ready' || status === 'accepted'
  return <Card className="space-y-5 p-5 shadow-none">
    <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">{reviewed ? (status === 'accepted' ? 'Presupuesto aceptado' : 'Presupuesto verificado por operaciones') : q.readyToOffer ? 'Presupuesto preliminar' : 'Estimación · requiere revisión'}</p><h2 className="mt-2 text-3xl font-black tabular-nums">{ars(q.total)}</h2><p className="mt-2 text-sm text-slate-600">{q.scope}</p></div>
    {q.manualPricing ? <dl className="space-y-2 text-sm"><Line label={q.serviceTitle ?? 'Servicio acordado'} amount={q.total} /></dl> : q.specialPricing ? <dl className="space-y-2 text-sm"><Line label="Mantenimiento · precio de prueba sin repuestos" amount={q.total} /></dl> : <dl className="space-y-2 text-sm">
      <Line label="Mano de obra" amount={q.labor} />
      {q.adjustments.map(line => <Line key={line.code} label={line.label} amount={line.amount} />)}
      <Line label="Materiales cotizados" amount={q.materialsAmount} />
      <Line label="Traslado ida y vuelta" amount={q.route ? q.travel : null} />
      <Line label="Subtotal calculado" amount={q.calculatorSubtotal} />
      <Line label={internal ? 'Recargo de protección (30%)' : 'Coordinación y cobertura del servicio'} amount={q.safetyAmount} />
      <Line label={reviewed ? "Total del presupuesto" : "Total preliminar"} amount={q.total} />
    </dl>}
    {internal ? <div className="rounded-2xl bg-slate-50 p-4"><dl className="space-y-2 text-sm"><Line label="Parte bruta del profesional" amount={q.professionalAmount} /><Line label={`Comisión Lysto (${Math.round(q.platformFeeRate * 10000) / 100}%)`} amount={q.platformFee} /></dl><p className="mt-3 text-xs text-slate-600">El presupuesto se divide entre Lysto y el profesional, sin sumar una provisión de cobro. La comisión Lysto se aplica sin aumentar el precio acordado. {q.manualPricing ? 'Precio y reparto personalizados para este servicio.' : q.specialPricing ? 'Este presupuesto usa el precio especial de prueba solicitado; no modifica la tarifa general.' : 'El 30% de protección ya está incluido en el total.'} Los cargos reales de Mercado Pago se registran por separado cuando confirma el pago.</p></div> : null}
    {q.route ? <p className="text-xs leading-5 text-slate-600">{q.route.origin} → {q.route.destination}. Ida: {q.route.outboundKm.toFixed(1)} km / {Math.ceil(q.route.outboundMinutes)} min. Vuelta: {q.route.returnKm.toFixed(1)} km / {Math.ceil(q.route.returnMinutes)} min. {q.route.source === 'simulation' ? 'Datos fijos de simulación.' : q.route.source === 'manual' ? 'Trayecto cargado por operaciones.' : 'Ruta estimada con Google Maps; el costo se calcula con la tarifa Lysto.'}</p> : null}
    {q.reviewReasons.length && !reviewed ? <div className="rounded-2xl bg-amber-50 p-4"><p className="text-sm font-bold text-amber-950">Antes de confirmar</p><ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-950">{q.reviewReasons.map(reason => <li key={reason}>{reviewReasonLabels[reason] ?? reason}</li>)}</ul></div> : null}
    <div className="text-xs leading-5 text-slate-600"><p className="font-bold">Fuera del alcance</p>{q.exclusions.length ? <ul className="list-disc pl-4">{q.exclusions.map(item => <li key={item}>{item}</li>)}</ul> : <p>No se registraron exclusiones en este presupuesto.</p>}<p className="mt-2">Otra falla detectada en la visita se registra por separado y requiere aceptación del cliente. Adicionales: 100% para el profesional antes de cargos de Mercado Pago, sin comisión ni recargo Lysto.</p></div>
    {internal && (q.source || q.sourceDate || q.version) ? <p className="text-xs text-slate-500">Fuente: {q.source ?? 'No registrada'}. Fecha: {q.sourceDate ?? 'No registrada'}. Versión: {q.version ?? 'No registrada'}.</p> : null}
  </Card>
}
function Line({ label, amount }: { label: string; amount: number | null }) { return <div className="flex items-start justify-between gap-4"><dt className="text-slate-600">{label}</dt><dd className="shrink-0 font-bold tabular-nums">{amount === null ? 'Pendiente' : ars(amount)}</dd></div> }
