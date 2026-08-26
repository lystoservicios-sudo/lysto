import { CustomerMaintenanceCenter } from '@/components/customer/customer-maintenance-center'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerMaintenancePage() {
  return (
    <PageScaffold title="Mantenimientos recomendados" eyebrow="Postventa · Demostración" description="Entendé qué cuidado necesita cada equipo y cuándo conviene revisarlo."><CustomerMaintenanceCenter maintenance={customerDemoFixtures.maintenance} /></PageScaffold>
  )
}
