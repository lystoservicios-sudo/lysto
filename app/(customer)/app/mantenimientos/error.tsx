'use client'

import { ErrorState } from '@/components/customer/states'

export default function CustomerMaintenanceError({ reset }: { reset: () => void }) {
  return <ErrorState title="No pudimos cargar las recomendaciones" description="Reintentá para recuperar el plan de mantenimiento." onRetry={reset} />
}
