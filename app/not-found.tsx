import { CustomerFeedback } from '@/components/customer/customer-feedback'

export default function NotFound() {
  return <CustomerFeedback kind="not-found" title="No encontramos esta página" description="Revisá el enlace o volvé al inicio para continuar." standalone />
}
