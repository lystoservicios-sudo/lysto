'use client'

import { ErrorState } from '@/components/customer/states'

export default function CustomerWarrantyError({ reset }: { reset: () => void }) {
  return <ErrorState title="No pudimos cargar tus garantías" description="Reintentá para recuperar coberturas y seguimientos." onRetry={reset} />
}
