import { PaymentPanel } from '@/components/payments/payment-panel'
import { FinancialExceptionsPanel } from '@/components/payments/financial-exceptions-panel'
import { requirePageSession } from '@/lib/auth/session'
export default async function Page() {
  const session = await requirePageSession('admin')
  const owner = session.permissions.includes('owner')
  return (
    <div className="space-y-6">
      <PaymentPanel role="admin" />
      <FinancialExceptionsPanel
        canFinance={owner || session.permissions.includes('finance')}
        canOperate={owner || session.permissions.includes('operations')}
      />
    </div>
  )
}
