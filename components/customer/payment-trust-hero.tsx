import { BadgeCheck, LockKeyhole, ReceiptText } from 'lucide-react'

const assurances = [
  { id: 'confirmation', icon: BadgeCheck, title: 'Confirmación externa', description: 'La interfaz no considera un pago aprobado por una respuesta local.' },
  { id: 'privacy', icon: LockKeyhole, title: 'Datos protegidos', description: 'Lysto no muestra números completos de tarjeta ni referencias sensibles.' },
  { id: 'traceability', icon: ReceiptText, title: 'Trazabilidad', description: 'Comprobantes y devoluciones aparecerán sólo con registros confirmados.' }
] as const

export function PaymentTrustHero() {
  return (
    <section aria-labelledby="payment-trust-title" className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-50">
      <div className="p-5 sm:p-6 lg:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Protección de principio a fin</p>
        <h2 id="payment-trust-title" className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-blue-950 sm:text-3xl">Tus pagos tendrán un circuito protegido</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900/80">Podés revisar importes y próximos pasos desde ahora. Cobros, comprobantes y devoluciones se habilitarán únicamente cuando la pasarela esté conectada.</p>
      </div>
      <ul className="grid gap-px bg-blue-100 md:grid-cols-3">
        {assurances.map(({ id, icon: Icon, title, description }) => (
          <li key={id} className="bg-white/90 p-4 sm:p-5">
            <Icon aria-hidden="true" className="h-5 w-5 text-violet-700" />
            <p className="mt-3 font-black text-slate-950">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
