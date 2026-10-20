import { requirePageSession } from '@/lib/auth/session'
import { AdminChargePanel } from './admin-charge-panel'
import { FinancialExceptionsPanel } from './financial-exceptions-panel'
import { PaymentPanel } from './payment-panel'

export async function AdminPayments() {
  const session = await requirePageSession('admin')
  const owner = session.permissions.includes('owner')
  const canFinance = owner || session.permissions.includes('finance')
  const canOperate = owner || session.permissions.includes('operations')
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Gestión de pagos</h1>
      <p className="mt-2 text-slate-600">Cobros, comisiones, devoluciones y cancelaciones de los servicios.</p></div>
    <PaymentPanel role="admin" />
    {canFinance ? <AdminChargePanel actorKey={session.profileId} /> : null}
    <FinancialExceptionsPanel canFinance={canFinance} canOperate={canOperate} actorKey={session.profileId} />
  </div>
}
