import { CatalogConsole } from '@/components/admin/live-operations'
import { requirePageSession } from '@/lib/auth/session'
import { adminCatalog } from '@/lib/operations/admin-console'

export default async function Page() {
  const catalog = await adminCatalog(await requirePageSession('admin'))
  return <CatalogConsole title="Diagnóstico preliminar" rows={catalog.questions} />
}
