import { PageScaffold } from '@/components/layout/page-scaffold'

export default function CustomerHomePage() {
  return (
    <PageScaffold
      eyebrow="Cliente"
      title="Mi hogar"
      description="Acá vas a poder organizar los lugares y direcciones asociados a tus servicios."
    >
      <p className="text-sm text-slate-600">
        Esta sección estará disponible próximamente.
      </p>
    </PageScaffold>
  )
}
