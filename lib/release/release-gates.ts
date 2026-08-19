export type ReleaseGateName =
  | 'domain_tests'
  | 'unit_tests'
  | 'e2e_tests'
  | 'typecheck'
  | 'build'
  | 'rls_review'
  | 'env_secrets'
  | 'mercadopago_sandbox'
  | 'supabase_migrations'
  | 'manual_mobile_qa'

export type ReleaseGate = {
  name: ReleaseGateName
  passed: boolean
  evidence: string
  required: boolean
}

export type ReleaseDecision = {
  canLaunch: boolean
  canDemo: boolean
  blockers: ReleaseGate[]
  warnings: ReleaseGate[]
}

export function evaluateReleaseGates(gates: ReleaseGate[]): ReleaseDecision {
  const blockers = gates.filter((gate) => gate.required && !gate.passed)
  const warnings = gates.filter((gate) => !gate.required && !gate.passed)
  const hardTechnical = ['domain_tests', 'typecheck', 'build', 'rls_review', 'supabase_migrations']
  const canDemo = gates.filter((gate) => hardTechnical.includes(gate.name)).every((gate) => gate.passed)
  return { canLaunch: blockers.length === 0, canDemo, blockers, warnings }
}

export const MVP_RELEASE_GATES: ReleaseGate[] = [
  { name: 'domain_tests', passed: true, evidence: 'tests/run-domain-tests.ts', required: true },
  { name: 'unit_tests', passed: false, evidence: 'requires pnpm install in local/CI', required: true },
  { name: 'e2e_tests', passed: false, evidence: 'requires Playwright browsers in local/CI', required: true },
  { name: 'typecheck', passed: false, evidence: 'requires node_modules and generated Next types', required: true },
  { name: 'build', passed: false, evidence: 'requires dependencies and env in local/CI', required: true },
  { name: 'rls_review', passed: true, evidence: 'supabase/migrations + tests/rls/rls-checklist.md', required: true },
  { name: 'env_secrets', passed: false, evidence: 'Walter must configure .env.local/GitHub/Vercel secrets', required: true },
  { name: 'mercadopago_sandbox', passed: false, evidence: 'requires Mercado Pago credentials', required: true },
  { name: 'supabase_migrations', passed: false, evidence: 'requires applying migrations to project dqonlqcurvjnjgsczevu', required: true },
  { name: 'manual_mobile_qa', passed: false, evidence: 'requires testing on phone viewport/device', required: false }
]
