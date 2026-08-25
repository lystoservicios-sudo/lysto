'use client'

import { ErrorState } from '@/components/customer/states'

export default function CustomerRequestsError({ reset }: { reset: () => void }) {
  return <ErrorState title="No pudimos cargar tus solicitudes" description="Reintentá para recuperar la información." onRetry={reset} />
}
