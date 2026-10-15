export const supportCategories = [
  { value: 'delay', label: 'Visita o demora' },
  { value: 'payment', label: 'Pago o comprobante' },
  { value: 'quality', label: 'Resultado del servicio' },
  { value: 'safety', label: 'Seguridad' },
  { value: 'warranty', label: 'Garantía' },
  { value: 'other', label: 'Cuenta u otra consulta' }
] as const
export type SupportCategory = typeof supportCategories[number]['value']
export const supportStatusLabels: Record<string, string> = { open: 'Recibida', in_review: 'En revisión', waiting_customer: 'Necesitamos tu respuesta', waiting_professional: 'Consultando al profesional', resolved: 'Resuelta', rejected: 'Cerrada' }
export const closedSupportCase = (status: string) => status === 'resolved' || status === 'rejected'
export const canCustomerReply = (status: string) => ['open', 'in_review', 'waiting_customer', 'waiting_professional'].includes(status)
export function supportDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sin fecha registrada'
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
}
export const supportArticles = [
  { slug: 'solicitar-un-servicio', category: 'Contratación', title: '¿Cómo pido un servicio?', paragraphs: ['Desde Pedir elegís el problema del aire acondicionado y el equipo. Podés usar un hogar guardado o completar la ubicación dentro de la solicitud.', 'Revisá los detalles, la visita y el precio antes de continuar al pago. Los trabajos adicionales o repuestos no incluidos deben informarse y aprobarse antes de cobrarse.'], href: '/app/solicitar/aire-acondicionado', action: 'Pedir un servicio' },
  { slug: 'seguir-mi-visita', category: 'Visitas', title: '¿Dónde consulto mi visita?', paragraphs: ['En Servicios encontrás la fecha, el horario y los datos confirmados de cada contratación. Abrí el servicio para consultar su estado y las acciones disponibles.', 'Si hay una demora o necesitás consultar sobre la visita, abrí una consulta asociada al servicio para que el equipo tenga su contexto.'], href: '/app/trabajos', action: 'Ver mis servicios' },
  { slug: 'pago-en-proceso', category: 'Pagos', title: 'Mi pago está en proceso, ¿qué hago?', paragraphs: ['Un pago en proceso todavía no es un pago rechazado. Revisá su estado en Pagos y comprobantes antes de iniciar un nuevo intento.', 'La confirmación se muestra cuando Mercado Pago informa el resultado. Si ves un cobro que no reconocés o un problema con el estado, abrí una consulta desde el pago correspondiente.'], href: '/app/pagos', action: 'Consultar mis pagos' },
  { slug: 'comprobantes-y-reintegros', category: 'Pagos', title: 'Comprobantes y reintegros', paragraphs: ['En el detalle de cada pago podés consultar el importe, el servicio y las referencias disponibles. Un comprobante de pago acredita el movimiento y no reemplaza una factura fiscal.', 'Cuando existe un reintegro, su estado corresponde a la información registrada. No hagas otro pago para intentar acelerar una devolución.'], href: '/app/pagos', action: 'Ver pagos y comprobantes' },
  { slug: 'problema-despues-del-servicio', category: 'Garantías', title: 'El problema volvió después del servicio', paragraphs: ['Abrí Garantías y reclamos y elegí el servicio finalizado. Describí qué ocurrió, indicá si es el mismo problema y adjuntá fotos si ayudan a entenderlo.', 'El equipo revisará el cierre técnico y la cobertura registrada. Informar un problema no implica aprobar automáticamente una garantía; aunque no exista cobertura vigente, podés pedir ayuda.'], href: '/app/garantias', action: 'Ver garantías y reclamos' },
  { slug: 'actualizar-mis-datos', category: 'Cuenta', title: '¿Cómo cambio mis datos?', paragraphs: ['En Mis datos podés actualizar la información personal disponible. Los cambios de correo requieren confirmar la nueva dirección.', 'Los hogares, direcciones, ambientes y equipos se administran en Hogar, para no mezclarlos con tus datos personales.'], href: '/app/perfil', action: 'Ir a mis datos' },
  { slug: 'riesgo-con-el-equipo', category: 'Seguridad', title: 'Si el equipo presenta un riesgo', paragraphs: ['Si hay humo, chispas, olor a quemado u otro riesgo, dejá de usar el equipo. Desconectalo únicamente si podés hacerlo de forma segura y no intentes repararlo.', 'Ante un peligro inmediato contactá al servicio de emergencias local. Una consulta en Lysto no es un canal de emergencias ni garantiza atención inmediata.'], href: '/app/ayuda/nueva?categoria=safety', action: 'Informar a Lysto' }
] as const
export type SupportCaseView = {
  id: string; jobId: string | null; category: string; status: string; description: string;
  publicResolution: string | null; version: number; createdAt: string;
  warrantyClaim: { id: string; status: string; coverageEligible: boolean; coverageUntil: string | null; revisitJobId: string | null } | null;
  events: { id: string; type: string; fromStatus: string | null; toStatus: string | null; message: string | null; evidenceIds: string[]; createdAt: string }[]
}
export type SupportJobOption = { id: string; requestId: string; label: string }
export type WarrantyService = SupportJobOption & { equipment: string; completedAt: string | null; warrantyUntil: string | null; claim: { id: string; caseId: string | null; status: string; description: string; resolution: string | null } | null }
