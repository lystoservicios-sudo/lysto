import { unavailableRoute } from '@/lib/http/route-handler'

// Closed until the authorized, persistent implementation replaces this contract.
export const POST = unavailableRoute({ roles: ['admin'], permission: 'finance' })
