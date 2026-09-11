import { PaymentPanel } from '@/components/payments/payment-panel'
import { PageScaffold } from '@/components/layout/page-scaffold'

export default function CustomerPaymentsPage() {
  return <PageScaffold title="Pagos y movimientos" eyebrow="Protección Lysto" description="Consultá los pagos de tus servicios y sus estados confirmados por Mercado Pago."><PaymentPanel role="customer" /></PageScaffold>
}
