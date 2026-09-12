import { PaymentPanel } from '@/components/payments/payment-panel'
import { ButtonLink } from '@/components/ui/button'

export default function Page() {
  return (
    <div className="space-y-5">
      <ButtonLink href="/admin/pagos/split">Excepciones y conciliación</ButtonLink>
      <PaymentPanel role="admin" />
    </div>
  )
}
