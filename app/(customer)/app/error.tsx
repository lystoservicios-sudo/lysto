'use client'

import { CustomerFeedback, uncertainOperationMessage } from '@/components/customer/customer-feedback'

export default function CustomerHomeError({ reset }: { error: Error; reset: () => void }) {
  return <CustomerFeedback title="No pudimos cargar esta pantalla" description={`Volvé a cargarla en unos momentos. ${uncertainOperationMessage}`} onRetry={() => reset()} />
}
