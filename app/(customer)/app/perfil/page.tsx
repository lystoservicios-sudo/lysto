import { PageScaffold } from '@/components/layout/page-scaffold'
import { CustomerProfileForm } from '@/components/customer/customer-profile-form'
import { InfoNotice } from '@/components/customer/info-notice'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerProfilePage() {
  return (
    <PageScaffold title="Tu perfil" eyebrow="Cliente · Demostración" description="Revisá tus datos de contacto y cómo querés recibir novedades sobre una visita.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <CustomerProfileForm initialValue={customerDemoFixtures.profile} />
        <InfoNotice tone="security" title="Tus datos son parte de la coordinación" description="Lysto usará esta información para identificarte y mantener el contacto dentro de cada servicio. En esta demostración, los cambios no se guardan." />
      </div>
    </PageScaffold>
  )
}
