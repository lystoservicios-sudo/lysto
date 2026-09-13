import { PublicShell } from '@/components/layout/page-shell'

export function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          Borrador informativo pendiente de aprobación de dirección y revisión profesional. El
          registro comercial permanece deshabilitado hasta publicar una versión aprobada.
        </p>
        <h1 className="mt-7 text-4xl font-black text-slate-950">{title}</h1>
        <div className="mt-7 space-y-7 text-base leading-7 text-slate-700">{children}</div>
      </main>
    </PublicShell>
  )
}
