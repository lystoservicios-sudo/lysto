'use client'

import { CustomerFeedback, uncertainOperationMessage } from '@/components/customer/customer-feedback'

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerFeedback title="No pudimos abrir esta pantalla" description={`Volvé a cargarla en unos momentos. ${uncertainOperationMessage}`} onRetry={() => reset()} standalone />
}
