import { LoadingSkeleton } from '@/components/customer/states'

export default function CustomerEquipmentLoading() {
  return <LoadingSkeleton label="Cargando equipos" rows={7} />
}
