'use client'

import { CustomerFeedback, uncertainOperationMessage } from '@/components/customer/customer-feedback'

export default function CustomerMaintenanceError({ reset }: { error: Error; reset: () => void }) {
  return <CustomerFeedback title="No pudimos cargar las recomendaciones" description={`Volvé a consultar el cuidado de tus equipos. ${uncertainOperationMessage}`} onRetry={reset} sectionLink={{ href: '/app/mas', label: 'Volver a Más' }} />
}
