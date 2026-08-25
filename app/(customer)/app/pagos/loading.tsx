import { LoadingSkeleton } from '@/components/customer/states'

export default function CustomerPaymentsLoading() {
  return <LoadingSkeleton label="Cargando pagos" rows={8} />
}
