import { PageScaffold } from '@/components/layout/page-scaffold'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import { readCustomerSession } from '@/lib/auth/customer-session'
import { customerDestination } from '@/lib/auth/customer-access'
import { redirect } from 'next/navigation'

export default async function RequestAirConditioningPage() {
  const next = '/app/solicitar/aire-acondicionado'
  const session = await readCustomerSession().catch(() => null)
  if (!session) redirect('/login?notice=unavailable')
  if (session.kind !== 'customer') redirect(`/login?next=${encodeURIComponent(next)}`)
  const destination = customerDestination(session, next)
  if (destination !== next || !session.address) redirect(destination)
  const address = session.address
  return (
    <PageScaffold
      title="Solicitar servicio"
      eyebrow="Tu próximo servicio"
      description="Contanos qué necesitás y revisá tu presupuesto. Solo se guarda cuando lo indicás. Sin cobros en esta etapa."
    >
      <AirConditioningWizard initialAddress={{ street: address.street, number: address.number, floor: address.floor ?? '', apartment: address.apartment ?? '', city: address.city, province: address.province, propertyType: address.property_type, reference: address.reference ?? '', postalCode: address.postal_code ?? '' }}
        initialAccess={{ hasElevator: address.has_elevator ?? undefined, hasParking: address.has_parking ?? undefined, stairsRequired: address.stairs_required ?? undefined, outdoorUnitAtHeight: address.outdoor_unit_at_height ?? undefined, outdoorUnitOnBalcony: address.outdoor_unit_on_balcony ?? undefined, difficultAccess: address.difficult_access ?? undefined }} />
    </PageScaffold>
  )
}
