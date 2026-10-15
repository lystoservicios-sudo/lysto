import { privateRoute } from '@/lib/http/route-handler'
import { exportCustomerAccount } from '@/lib/customer-account/service'
import { enforceRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const GET = privateRoute({ roles: ['customer'] }, async (_request, session) => {
  await enforceRateLimit('receipt', `${session.profileId}:customer-data-export`)
  const data = await exportCustomerAccount(session)
  return new Response(JSON.stringify(data, null, 2), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="mis-datos-lysto.json"',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
  } })
})
