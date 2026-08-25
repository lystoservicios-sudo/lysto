import { LoadingSkeleton } from '@/components/customer/states'

export default function CustomerRequestsLoading() {
  return <LoadingSkeleton label="Cargando solicitudes" rows={6} />
}
