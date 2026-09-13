import { PaymentsPage } from '@/components/admin/admin-lists'
import { ButtonLink } from '@/components/ui/button'

export default function Page() { return <div className="space-y-5"><ButtonLink href="/admin/pagos/split">Cobros conectados a Mercado Pago</ButtonLink><PaymentsPage /></div> }
