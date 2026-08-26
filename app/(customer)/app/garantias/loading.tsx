import { LoadingSkeleton } from '@/components/customer/states'

export default function CustomerWarrantyLoading() {
  return <LoadingSkeleton label="Cargando garantías" rows={8} />
}
