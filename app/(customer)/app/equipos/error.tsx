'use client'

import { ErrorState } from '@/components/customer/states'

export default function CustomerEquipmentError({ reset }: { reset: () => void }) {
  return <ErrorState title="No pudimos cargar tus equipos" description="Reintentá para recuperar las fichas y su historial." onRetry={reset} />
}
