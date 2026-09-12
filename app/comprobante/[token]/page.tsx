import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { lookupPublicReceipt } from '@/lib/receipts/public-receipt-service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Comprobante de servicio | Lysto',
  robots: { index: false, follow: false }
}

const dates = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' })
const status = {
  pending_confirmation: 'Pendiente de conformidad del cliente',
  confirmed: 'Servicio confirmado por el cliente',
  disputed: 'Servicio con desacuerdo en revisión'
} as const
const outcomes: Record<string, string> = {
  resolved: 'Resuelto',
  partially_resolved: 'Parcialmente resuelto',
  pending_part: 'Pendiente de repuesto',
  requires_second_visit: 'Requiere segunda visita',
  not_resolved: 'No resuelto'
}
export default async function PublicReceiptPage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params,
    receipt = await lookupPublicReceipt(token)
  if (!receipt) notFound()
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-10">
      <Card className="space-y-6 p-6 sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
            Comprobante de servicio Lysto
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{receipt.service_name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Emitido el {dates.format(new Date(receipt.issued_at))}
          </p>
        </div>
        <dl className="grid gap-4 border-y border-slate-200 py-5">
          <div>
            <dt className="text-xs font-bold uppercase text-slate-500">Profesional</dt>
            <dd className="mt-1 font-semibold">{receipt.professional_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-slate-500">Trabajo realizado</dt>
            <dd className="mt-1 whitespace-pre-line">{receipt.work_done}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-slate-500">Resultado técnico</dt>
            <dd className="mt-1 font-semibold">
              {outcomes[receipt.final_state] ?? receipt.final_state}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-slate-500">Conformidad</dt>
            <dd className="mt-1 font-semibold">{status[receipt.confirmation_status]}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-slate-500">Garantía informada</dt>
            <dd className="mt-1">
              {receipt.warranty_until
                ? `Hasta el ${dates.format(new Date(`${receipt.warranty_until}T00:00:00Z`))}`
                : 'Sin garantía automática registrada'}
            </dd>
          </div>
          {receipt.next_maintenance_date ? (
            <div>
              <dt className="text-xs font-bold uppercase text-slate-500">
                Próximo mantenimiento sugerido
              </dt>
              <dd className="mt-1">
                {dates.format(new Date(`${receipt.next_maintenance_date}T00:00:00Z`))}
              </dd>
            </div>
          ) : null}
        </dl>
        <p className="text-sm leading-6 text-slate-600">
          Este documento acredita el registro del servicio en Lysto. No reemplaza la factura o
          comprobante fiscal que corresponda emitir.
        </p>
      </Card>
    </main>
  )
}
