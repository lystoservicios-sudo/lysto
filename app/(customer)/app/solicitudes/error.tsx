'use client'

import { CustomerFeedback, uncertainOperationMessage } from '@/components/customer/customer-feedback'

export default function CustomerRequestsError({ reset }: { error: Error; reset: () => void }) {
  return <CustomerFeedback title="No pudimos cargar tus solicitudes" description={`Volvé a consultar la información de tus pedidos. ${uncertainOperationMessage}`} onRetry={reset} sectionLink={{ href: '/app/trabajos', label: 'Volver a Servicios' }} />
}
