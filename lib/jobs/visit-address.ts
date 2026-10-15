import { addressInputSchema } from '@/lib/customer-assets/contracts'

export type RequestVisitContext = {
  contractSource?: string | null
  visitAddressSnapshot?: unknown
}

const addressSchema = addressInputSchema.pick({ street: true, number: true, city: true, floor: true, apartment: true }).strip()

/** A contracted destination must never fall back to the equipment's historical location. */
export function requestVisitAddress(
  context: RequestVisitContext | undefined,
  legacyAddress?: string
): string | undefined {
  const snapshot = addressSchema.safeParse(context?.visitAddressSnapshot)
  if (snapshot.success) {
    const address = snapshot.data
    return [
      `${address.street} ${address.number}`,
      [address.floor ? `Piso ${address.floor}` : null, address.apartment ? `Depto. ${address.apartment}` : null].filter(Boolean).join(' '),
      address.city
    ].filter(Boolean).join(', ')
  }
  return context?.contractSource != null ? undefined : legacyAddress
}

export function isExpiredAutomaticRequest(
  context: (RequestVisitContext & { status?: string }) | undefined
): boolean {
  return context?.contractSource === 'automatic_customer_request' && context.status === 'expired'
}
