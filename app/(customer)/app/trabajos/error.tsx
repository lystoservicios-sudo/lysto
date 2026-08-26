'use client'

import { ErrorState } from '@/components/customer/states'

export default function CustomerJobsError({ reset }: { reset: () => void }) {
  return <ErrorState title="No pudimos cargar tus trabajos" description="Reintentá para recuperar el seguimiento." onRetry={reset} />
}
