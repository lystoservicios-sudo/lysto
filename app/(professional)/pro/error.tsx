'use client'
import { ErrorState } from '@/components/customer/states'
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorState title="No pudimos cargar esta pantalla" description="Tus datos enviados no se modificaron. Probá nuevamente." onRetry={reset} /> }
