import { MapPinned, Navigation } from 'lucide-react'

export function LiveTrackingCard({ status }: { status?: string }) {
  return (
    <section aria-labelledby="tracking-title" className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="grid min-h-32 place-items-center bg-slate-100 p-5 text-center text-slate-500">
        <MapPinned aria-hidden="true" className="h-8 w-8" />
        <span className="mt-2 text-xs font-semibold">Mapa no conectado</span>
      </div>
      <div className="p-4">
        <h2 id="tracking-title" className="flex items-center gap-2 font-black text-slate-950"><Navigation aria-hidden="true" className="h-4 w-4 text-blue-700" />Seguimiento visual</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{status ?? 'No hay ubicación en tiempo real disponible.'}</p>
      </div>
    </section>
  )
}
