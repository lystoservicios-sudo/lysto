import { ConnectedCustomerMaintenance } from '@/components/customer/connected-customer-maintenance'
import { MorePage } from '@/components/customer/more/more-ui'

export default function CustomerMaintenancePage() {
  return (
    <MorePage title="Mantenimientos" description="El cuidado recomendado para cada aire, conectado con su historial y sus servicios.">
      <ConnectedCustomerMaintenance />
    </MorePage>
  )
}
