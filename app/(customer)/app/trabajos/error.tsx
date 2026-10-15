'use client'

import { CustomerFeedback, uncertainOperationMessage } from '@/components/customer/customer-feedback'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerFeedback title="No pudimos cargar Servicios" description={`Volvé a consultar el seguimiento de tus pedidos. ${uncertainOperationMessage}`} onRetry={() => reset()} />
}
