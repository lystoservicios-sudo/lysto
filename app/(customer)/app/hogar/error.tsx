'use client'

import { CustomerFeedback, uncertainOperationMessage } from '@/components/customer/customer-feedback'

export default function CustomerHogarError({ reset }: { error: Error; reset: () => void }) {
  return <CustomerFeedback title="No pudimos cargar Hogar" description={`Volvé a consultar tus espacios y equipos. ${uncertainOperationMessage}`} onRetry={reset} />
}
