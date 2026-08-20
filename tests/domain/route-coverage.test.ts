import { test, expect } from '../_lib/test.ts'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const page = (path: string) => existsSync(join(root, path, 'page.tsx'))
const route = (path: string) => existsSync(join(root, path, 'route.ts'))
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const requiredPages = [
  'app/(public)',
  'app/(public)/servicios/aire-acondicionado',
  'app/(public)/como-funciona',
  'app/(public)/ayuda',
  'app/(auth)/login',
  'app/(auth)/registro',
  'app/(customer)/app',
  'app/(customer)/app/solicitar/aire-acondicionado',
  'app/(customer)/app/solicitudes',
  'app/(customer)/app/solicitudes/[id]',
  'app/(customer)/app/trabajos',
  'app/(customer)/app/trabajos/[id]',
  'app/(customer)/app/trabajos/[id]/review',
  'app/(customer)/app/equipos',
  'app/(customer)/app/equipos/[id]',
  'app/(customer)/app/direcciones',
  'app/(customer)/app/pagos',
  'app/(customer)/app/perfil',
  'app/(customer)/app/garantias',
  'app/(customer)/app/mantenimientos',
  'app/(professional)/pro/dashboard',
  'app/(professional)/pro/onboarding/[token]',
  'app/(professional)/pro/solicitudes',
  'app/(professional)/pro/solicitudes/[id]',
  'app/(professional)/pro/trabajos',
  'app/(professional)/pro/trabajos/[id]',
  'app/(professional)/pro/agenda',
  'app/(professional)/pro/equipos/[id]',
  'app/(professional)/pro/pagos',
  'app/(professional)/pro/perfil',
  'app/(professional)/pro/mercadopago',
  'app/(professional)/pro/soporte',
  'app/(professional)/pro/capacitacion',
  'app/(admin)/admin/dashboard',
  'app/(admin)/admin/solicitudes',
  'app/(admin)/admin/solicitudes/[id]',
  'app/(admin)/admin/trabajos',
  'app/(admin)/admin/trabajos/[id]',
  'app/(admin)/admin/profesionales',
  'app/(admin)/admin/profesionales/[id]',
  'app/(admin)/admin/profesionales/invitaciones',
  'app/(admin)/admin/clientes',
  'app/(admin)/admin/clientes/[id]',
  'app/(admin)/admin/equipos',
  'app/(admin)/admin/pagos',
  'app/(admin)/admin/precios',
  'app/(admin)/admin/servicios',
  'app/(admin)/admin/diagnostico',
  'app/(admin)/admin/calidad',
  'app/(admin)/admin/configuracion',
  'app/(admin)/admin/auditoria',
  'app/(admin)/admin/reclamos',
  'app/(admin)/admin/garantias',
  'app/(admin)/admin/notificaciones',
  'app/(admin)/admin/zonas',
  'app/(admin)/admin/reportes',
  'app/(admin)/admin/matching',
  'app/(admin)/admin/marketplace',
  'app/comprobante/[token]'
]

const requiredRoutes = [
  'app/api/customer/request/submit',
  'app/api/service-request/preview',
  'app/api/diagnosis/generate',
  'app/api/uploads/sign',
  'app/api/mercadopago/create-preference',
  'app/api/mercadopago/webhook',
  'app/api/mercadopago/oauth/callback',
  'app/api/payments/webhook/apply',
  'app/api/admin/invite-professional',
  'app/api/admin/assign-professional',
  'app/api/admin/approve-professional',
  'app/api/admin/pricing/update',
  'app/api/admin/professionals/approve',
  'app/api/professional/onboarding',
  'app/api/professional/respond-request',
  'app/api/pro/jobs/action',
  'app/api/jobs/update-status',
  'app/api/jobs/advance',
  'app/api/jobs/final-report',
  'app/api/equipment/register',
  'app/api/reviews/submit',
  'app/api/maintenance/schedule',
  'app/api/notifications/emit',
  'app/api/quality/open-case',
  'app/api/warranty/claim'
]

test('all MVP screen routes exist', () => {
  const missing = requiredPages.filter((path) => !page(path))
  expect(missing).toEqual([])
})

test('all MVP API route contracts exist', () => {
  const missing = requiredRoutes.filter((path) => !route(path))
  expect(missing).toEqual([])
})

test('customer wizard contains all business steps discussed', () => {
  const content = read('features/service-request/air-conditioning-wizard.tsx')
  for (const text of ['¿Qué sucede?', 'Contanos un poco más', 'Diagnóstico preliminar', '¿Dónde está el equipo?', 'Elegí el horario', 'Elegí tu presupuesto', 'Pago protegido', 'Buscando el mejor profesional', 'Técnico confirmado']) {
    expect(content).toIncludeText(text)
  }
})

test('admin screens cover quality payments matching and marketplace configuration', () => {
  const dashboard = read('components/layout/app-navigation-config.ts')
  for (const text of ['Solicitudes', 'Trabajos', 'Profesionales', 'Pagos', 'Matching', 'Calidad', 'Reportes']) {
    expect(dashboard).toIncludeText(text)
  }
})

test('transactional Supabase workflow migration exists', () => {
  const content = read('supabase/migrations/202608190004_transactional_workflows.sql')
  for (const fn of ['create_service_request_from_app', 'apply_mercadopago_payment_webhook', 'assign_professional_to_job', 'professional_respond_to_job', 'close_job_with_final_report', 'submit_customer_review_transaction']) {
    expect(content).toIncludeText(fn)
  }
})
