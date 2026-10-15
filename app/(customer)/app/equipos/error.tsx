'use client'

import { CustomerFeedback, uncertainOperationMessage } from '@/components/customer/customer-feedback'

export default function CustomerEquipmentError({ reset }: { error: Error; reset: () => void }) {
  return <CustomerFeedback title="No pudimos cargar tus equipos" description={`Volvé a consultar las fichas y su historial. ${uncertainOperationMessage}`} onRetry={reset} sectionLink={{ href: '/app/hogar', label: 'Volver a Hogar' }} />
}
