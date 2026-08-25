import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/customer/states'

export default function CustomerJobNotFound() {
  return <EmptyState title="No encontramos ese trabajo" description="El enlace puede ser incorrecto o el trabajo ya no estar disponible." action={<ButtonLink href="/app/trabajos" variant="secondary">Volver a mis trabajos</ButtonLink>} />
}
