type SupabaseClientLike = { rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> }

export async function applyMercadoPagoWebhookTransaction(supabase: SupabaseClientLike, input: { providerEventId: string; providerPaymentId: string; providerStatus: string; rawPayload: Record<string, unknown> }) {
  const { data, error } = await supabase.rpc('apply_mercadopago_payment_webhook', {
    p_provider_event_id: input.providerEventId,
    p_provider_payment_id: input.providerPaymentId,
    p_provider_status: input.providerStatus,
    p_raw_payload: input.rawPayload
  })
  if (error) throw new Error(`applyMercadoPagoWebhookTransaction:${error.message}`)
  return data
}
