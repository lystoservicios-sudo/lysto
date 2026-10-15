'use client'

import { CustomerFeedback, feedbackStyles, uncertainOperationMessage } from '@/components/customer/customer-feedback'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="es-AR">
    <head><title>No pudimos abrir Lysto</title><meta name="robots" content="noindex" /></head>
    <body className={feedbackStyles.document}>
      <CustomerFeedback title="No pudimos abrir Lysto" description={`Intentá cargar la app de nuevo. ${uncertainOperationMessage}`} onRetry={() => reset()} standalone />
    </body>
  </html>
}
