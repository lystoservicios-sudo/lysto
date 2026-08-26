import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/customer/states'

export default function CustomerRequestNotFound() {
  return (
    <EmptyState
      title="No encontramos esa solicitud"
      description="El enlace puede ser incorrecto o la solicitud ya no estar disponible."
      action={<ButtonLink href="/app/solicitudes" variant="secondary">Volver a mis solicitudes</ButtonLink>}
    />
  )
}
