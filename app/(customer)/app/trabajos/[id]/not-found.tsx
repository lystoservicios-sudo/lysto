import { CustomerFeedback, unavailableContentMessage } from '@/components/customer/customer-feedback'

export default function CustomerJobNotFound() {
  return <CustomerFeedback kind="not-found" title="No encontramos ese servicio" description={unavailableContentMessage} sectionLink={{ href: '/app/trabajos', label: 'Volver a Servicios' }} />
}
