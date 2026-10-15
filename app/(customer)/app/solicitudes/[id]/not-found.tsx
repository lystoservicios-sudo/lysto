import { CustomerFeedback, unavailableContentMessage } from '@/components/customer/customer-feedback'

export default function CustomerRequestNotFound() {
  return <CustomerFeedback kind="not-found" title="No encontramos esa solicitud" description={unavailableContentMessage} sectionLink={{ href: '/app/trabajos', label: 'Volver a Servicios' }} />
}
