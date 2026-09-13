import { EmptyState } from '@/components/customer/states'
import { ButtonLink } from '@/components/ui/button'
export default function NotFound() { return <EmptyState title="No encontramos ese registro" description="El enlace puede ser incorrecto o el registro no estar disponible para este perfil demostrativo." action={<ButtonLink href="/pro/dashboard">Volver a mi jornada</ButtonLink>} /> }
