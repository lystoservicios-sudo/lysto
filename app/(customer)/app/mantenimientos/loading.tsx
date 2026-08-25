import { LoadingSkeleton } from '@/components/customer/states'

export default function CustomerMaintenanceLoading() {
  return <LoadingSkeleton label="Cargando mantenimientos" rows={7} />
}
