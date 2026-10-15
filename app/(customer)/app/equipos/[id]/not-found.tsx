import { CustomerFeedback, unavailableContentMessage } from '@/components/customer/customer-feedback'

export default function CustomerEquipmentNotFound() {
  return <CustomerFeedback kind="not-found" title="No encontramos ese equipo" description={unavailableContentMessage} sectionLink={{ href: '/app/hogar', label: 'Volver a Hogar' }} />
}
