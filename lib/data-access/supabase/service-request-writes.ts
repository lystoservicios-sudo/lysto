import type { CustomerRequestPrepared } from '../../use-cases/customer-request.ts'

type SupabaseClientLike = { rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> }

export type PersistPreparedRequestInput = {
  customerId: string
  addressId: string
  categorySlug: 'aire_acondicionado'
  issueSlug: string
  timeSince: string
  preferredDate: string
  preferredTimeWindow: string
  prepared: CustomerRequestPrepared
  selectedOption: 'flexible' | 'priority'
}

export async function persistPreparedServiceRequest(supabase: SupabaseClientLike, input: PersistPreparedRequestInput) {
  const { data, error } = await supabase.rpc('create_service_request_from_app', {
    p_customer_id: input.customerId,
    p_address_id: input.addressId,
    p_category_slug: input.categorySlug,
    p_issue_slug: input.issueSlug,
    p_time_since: input.timeSince,
    p_preferred_date: input.preferredDate,
    p_preferred_time_window: input.preferredTimeWindow,
    p_selected_option: input.selectedOption,
    p_diagnosis: input.prepared.diagnosis,
    p_flexible_price: input.selectedOption === 'flexible' ? input.prepared.selectedPrice.total : null,
    p_priority_price: input.selectedOption === 'priority' ? input.prepared.selectedPrice.total : null,
    p_selected_amount: input.prepared.paymentAmount
  })
  if (error) throw new Error(`persistPreparedServiceRequest:${error.message}`)
  return data
}
