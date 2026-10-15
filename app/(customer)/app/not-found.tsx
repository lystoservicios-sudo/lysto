import { CustomerFeedback, unavailableContentMessage } from '@/components/customer/customer-feedback'

export default function CustomerNotFound() {
  return <CustomerFeedback kind="not-found" title="No encontramos esta página" description={unavailableContentMessage} sectionLink={{ href: '/app/trabajos', label: 'Volver a Servicios' }} />
}
