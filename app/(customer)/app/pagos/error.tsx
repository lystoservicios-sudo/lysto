'use client'

import { ErrorState } from '@/components/customer/states'

export default function CustomerPaymentsError({ reset }: { reset: () => void }) {
  return <ErrorState title="No pudimos cargar tus pagos" description="Reintentá para consultar el estado de la integración y tus movimientos confirmados." onRetry={reset} />
}
