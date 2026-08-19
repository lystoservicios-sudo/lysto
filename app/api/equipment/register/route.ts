import { NextResponse } from 'next/server'
import { validateEquipmentRegistration, type EquipmentRegistrationInput } from '@/lib/equipment/equipment-registry'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as EquipmentRegistrationInput | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  const result = validateEquipmentRegistration(body)
  if (!result.ok) return NextResponse.json({ error: 'Invalid equipment registration', details: result.errors }, { status: 400 })
  return NextResponse.json({ result, persistence: 'Insert/update customer_equipment and link with job_final_reports/equipment_service_records.' })
}
