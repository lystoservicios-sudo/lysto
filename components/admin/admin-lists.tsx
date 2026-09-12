import { LiveRecords } from './live-operations'

export function RequestsPage() {
  return (
    <LiveRecords
      title="Solicitudes"
      description="La página productiva carga solicitudes autorizadas."
      rows={[]}
    />
  )
}
export function JobsPage() {
  return (
    <LiveRecords
      title="Trabajos"
      description="La página productiva carga trabajos autorizados."
      rows={[]}
    />
  )
}
export function CustomersPage() {
  return (
    <LiveRecords
      title="Clientes"
      description="La página productiva carga clientes autorizados."
      rows={[]}
    />
  )
}
export function EquipmentPage() {
  return (
    <LiveRecords
      title="Equipos"
      description="La página productiva carga equipos autorizados."
      rows={[]}
    />
  )
}
export function PaymentsPage() {
  return (
    <LiveRecords
      title="Pagos"
      description="La página productiva usa el libro de Mercado Pago."
      rows={[]}
    />
  )
}
