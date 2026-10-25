/** Explicit allowlist: customer payment screens never receive the internal split. */
export function customerCheckoutProjection(row: Record<string, unknown>) {
  return {
    id: row.id, job_id: row.job_id, extra_id: row.extra_id, amount: row.amount,
    status: row.status, live_mode: row.live_mode, expires_at: row.expires_at,
    created_at: row.created_at, checkout_protocol: row.checkout_protocol, review_reason: null,
    observations: Array.isArray(row.observations) ? row.observations.map(value => ({
      paymentId: value.paymentId, status: value.status, refunded: value.refunded
    })) : []
  }
}
