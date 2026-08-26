import { CustomerWarrantyCenter } from '@/components/customer/customer-warranty-center'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerWarrantyPage() {
  return (
    <PageScaffold title="Garantías y calidad" eyebrow="Respaldo Lysto · Demostración" description="Consultá coberturas, reclamos y seguimientos posteriores al servicio.">
      <CustomerWarrantyCenter warranties={customerDemoFixtures.warranties} qualityFollowups={customerDemoFixtures.qualityFollowups} recognition={customerDemoFixtures.recognition} />
    </PageScaffold>
  )
}
