import { LoadingSkeleton } from '@/components/customer/states'

export default function CustomerJobsLoading() {
  return <LoadingSkeleton label="Cargando trabajos" rows={7} />
}
