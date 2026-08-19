import { PublicShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'

export default function PublicReceiptPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card className="p-6 sm:p-8">
          <Badge tone="green">Comprobante Lysto</Badge>
          <h1 className="mt-4 text-3xl font-black text-slate-950">Servicio realizado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Comprobante público con token seguro. No expone DNI, CUIL, teléfono privado ni dirección completa sensible.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Servicio</p><p className="mt-1 font-black">Aire acondicionado · No enfría</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Fecha</p><p className="mt-1 font-black">19/08/2026</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Profesional</p><p className="mt-1 font-black">Martín Gómez · Verificado</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Garantía</p><p className="mt-1 font-black">30 días según cierre técnico</p></div>
          </div>
          <div className="mt-6 rounded-3xl bg-blue-50 p-5 text-blue-950"><h2 className="font-black">Trabajo realizado</h2><p className="mt-2 text-sm leading-6">Diagnóstico presencial, revisión de presión, limpieza básica de filtros y recomendación de mantenimiento profundo en 6 meses.</p></div>
          <div className="mt-6"><ButtonLink href="/">Volver a Lysto</ButtonLink></div>
        </Card>
      </main>
    </PublicShell>
  )
}
