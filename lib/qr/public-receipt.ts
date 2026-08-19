export type PublicReceipt = {
  token: string
  jobId: string
  serviceName: string
  date: string
  professionalPublicName: string
  workDone: string
  warrantyText: string
  nextMaintenanceText: string
  hiddenFields: string[]
}

export function buildPublicReceipt(input: Omit<PublicReceipt, 'hiddenFields'>): PublicReceipt {
  if (!input.token || input.token.length < 8) throw new Error('Unsafe receipt token')
  return {
    ...input,
    hiddenFields: ['customer_phone', 'customer_email', 'dni', 'cuil', 'full_address_floor_apartment', 'internal_notes']
  }
}
