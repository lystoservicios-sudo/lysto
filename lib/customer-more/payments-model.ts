export const customerPaymentFilters = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'procesando', label: 'En proceso' },
  { value: 'pagados', label: 'Pagados' },
  { value: 'reintegros', label: 'Reintegros' }
] as const
export type CustomerPaymentFilter = typeof customerPaymentFilters[number]['value']

export function paymentListInput(input: Record<string, string | string[] | undefined> = {}) {
  const filter = customerPaymentFilters.find((item) => item.value === input.estado)?.value ?? 'todos'
  const page = typeof input.pagina === 'string' && /^\d{1,4}$/.test(input.pagina) && Number(input.pagina) > 0
    ? Number(input.pagina) : 1
  return { filter, page, pageSize: 20 }
}

type State = { label: string; description: string; tone: 'neutral' | 'action' | 'confirmed' | 'attention' }
const states: Record<string, State> = {
  awaiting_payment: { label: 'Pendiente de pago', description: 'Podés continuar con el pago del servicio.', tone: 'action' },
  creating: { label: 'Preparando pago', description: 'Estamos preparando el enlace. Consultá su estado antes de volver a intentarlo.', tone: 'attention' },
  ready: { label: 'Pendiente de pago', description: 'El enlace está listo para continuar con Mercado Pago.', tone: 'action' },
  pending: { label: 'Esperando confirmación', description: 'Mercado Pago todavía no confirmó el pago. No vuelvas a pagar mientras se verifica.', tone: 'attention' },
  in_process: { label: 'Pago en proceso', description: 'Tu pago se está verificando. No vuelvas a pagar mientras se procesa.', tone: 'attention' },
  approved: { label: 'Pago confirmado', description: 'El pago fue confirmado por Mercado Pago.', tone: 'confirmed' },
  rejected: { label: 'Pago rechazado', description: 'No se confirmó el pago. Podés consultar su estado y volver a intentarlo.', tone: 'action' },
  cancelled: { label: 'Pago cancelado', description: 'Este intento de pago fue cancelado.', tone: 'neutral' },
  refunded: { label: 'Reintegro confirmado', description: 'Mercado Pago confirmó el reintegro. La acreditación depende del medio de pago.', tone: 'confirmed' },
  partially_refunded: { label: 'Reintegro parcial', description: 'Se confirmó un reintegro de parte del importe pagado.', tone: 'confirmed' },
  review: { label: 'Pago en revisión', description: 'Estamos revisando una diferencia en el pago. No vuelvas a pagar.', tone: 'attention' },
  expired: { label: 'Enlace vencido', description: 'Consultá el servicio o pedí ayuda para revisar cómo continuar.', tone: 'neutral' },
  charged_back: { label: 'Contracargo informado', description: 'Hay un contracargo informado por el medio de pago. Consultá con soporte.', tone: 'attention' }
}
export function paymentState(status: string | null, expiresAt?: string | null, now = Date.now()): State {
  if (status && ['ready', 'creating', 'rejected', 'cancelled'].includes(status) && expiresAt && Date.parse(expiresAt) <= now) {
    return states.expired
  }
  return states[status ?? 'awaiting_payment'] ?? {
    label: 'Estado por verificar', description: 'Consultá el estado del pago antes de volver a pagar.', tone: 'attention'
  }
}
export function refundState(status: string): State {
  return ({
    requested: { label: 'Reintegro solicitado', description: 'La solicitud quedó registrada. Todavía no hay una devolución confirmada.', tone: 'attention' },
    processing: { label: 'Reintegro en proceso', description: 'Estamos procesando el reintegro con Mercado Pago.', tone: 'attention' },
    succeeded: { label: 'Reintegro confirmado', description: 'Mercado Pago confirmó el reintegro. La acreditación depende del medio de pago original.', tone: 'confirmed' },
    failed: { label: 'Necesita revisión', description: 'No se pudo completar el reintegro. Contactá a soporte para revisar el caso.', tone: 'attention' }
  } satisfies Record<string, State>)[status as 'requested' | 'processing' | 'succeeded' | 'failed'] ?? {
    label: 'Reintegro en revisión', description: 'Consultá con soporte para conocer el estado de la solicitud.', tone: 'attention'
  }
}
export function paymentRecordAvailable(input: { status: string; liveMode: boolean; providerReferences: readonly string[] }) {
  return input.liveMode && ['approved', 'refunded', 'partially_refunded'].includes(input.status) && input.providerReferences.length > 0
}
export const paymentCurrency = (amount: number) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(amount)
export const paymentDate = (date: string) => new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires'
}).format(new Date(date))

export type PaymentRecord = {
  jobId: string; checkoutId: string; service: string; amount: number; refundedAmount: number;
  status: string; createdAt: string; updatedAt: string; providerReferences: string[]; extraLabel: string | null
}
export function paymentRecordText(record: PaymentRecord) {
  return [
    'Lysto · Registro de pago',
    'No es una factura fiscal. Refleja el estado registrado y confirmado por Mercado Pago al momento de su consulta.',
    `Servicio: ${record.service}`, `Servicio Lysto: ${record.jobId}`, `Registro: ${record.checkoutId}`,
    record.extraLabel ? `Concepto: Adicional · ${record.extraLabel}` : 'Concepto: Servicio inicial',
    `Importe: ${paymentCurrency(record.amount)}`, `Estado: ${paymentState(record.status).label}`,
    `Registro creado: ${paymentDate(record.createdAt)}`, `Última actualización: ${paymentDate(record.updatedAt)}`,
    `Referencias Mercado Pago: ${record.providerReferences.join(', ')}`,
    record.refundedAmount > 0 ? `Reintegro confirmado: ${paymentCurrency(record.refundedAmount)}` : '',
    'Para solicitar una factura fiscal o hacer una consulta sobre este pago, ingresá a Ayuda desde tu cuenta Lysto.'
  ].filter(Boolean).join('\n')
}
