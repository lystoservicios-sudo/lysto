import { PaymentPanel } from '@/components/payments/payment-panel'
import { ButtonLink } from '@/components/ui/button'
export default function Page() {
  return (
    <div className="space-y-5">
      <ButtonLink href="/pro/pagos/mercadopago">Cuenta de cobro</ButtonLink>
      <PaymentPanel role="professional" />
    </div>
  )
}
