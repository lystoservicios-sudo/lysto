import { PublicShell } from '@/components/layout/page-shell'

export function PolicyPage({ title, version, effectiveDate, children }: { title: string; version?: string; effectiveDate?: string; children: React.ReactNode }) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {version && effectiveDate ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">
            Versión {version} · Vigente desde el {effectiveDate}
          </p>
        ) : (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
            Borrador informativo pendiente de aprobación de dirección y revisión profesional.
          </p>
        )}
        <h1 className="mt-7 text-4xl font-black text-slate-950">{title}</h1>
        <div className="mt-7 space-y-7 text-base leading-7 text-slate-700">{children}</div>
      </main>
    </PublicShell>
  )
}
