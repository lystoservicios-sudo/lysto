import { EmptyState } from '@/components/customer/states'
import { ButtonLink } from '@/components/ui/button'

export default function CustomerEquipmentNotFound() {
  return <EmptyState title="No encontramos ese equipo" description="El enlace puede ser incorrecto o la ficha todavía no estar disponible." action={<ButtonLink href="/app/equipos" variant="secondary">Volver a mis equipos</ButtonLink>} />
}
