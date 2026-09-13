export type ReleaseTarget = 'technical' | 'pilot' | 'general'
export type EvidenceKind = 'automated' | 'provider' | 'human'
export const RELEASE_GATE_CATALOG: ReadonlyArray<{ id: string; title: string; kinds: EvidenceKind[]; environments: string[]; maxAgeHours: number }> = [
  { id: 'G01', title: 'Fuente reproducible', kinds: ['automated'], environments: ['ci'], maxAgeHours: 72 },
  { id: 'G02', title: 'Dependencias y secretos', kinds: ['automated'], environments: ['ci'], maxAgeHours: 72 },
  { id: 'G03', title: 'Base reproducible y permisos', kinds: ['automated'], environments: ['disposable'], maxAgeHours: 72 },
  { id: 'G04', title: 'Identidad y autorización', kinds: ['automated'], environments: ['disposable', 'staging'], maxAgeHours: 72 },
  { id: 'G05', title: 'Alta y cuentas', kinds: ['automated'], environments: ['disposable', 'staging'], maxAgeHours: 72 },
  { id: 'G06', title: 'Solicitud hasta asignación', kinds: ['automated'], environments: ['disposable', 'staging'], maxAgeHours: 72 },
  { id: 'G07', title: 'Integridad financiera', kinds: ['automated'], environments: ['disposable', 'staging'], maxAgeHours: 72 },
  { id: 'G08', title: 'Servicio y posventa', kinds: ['automated'], environments: ['disposable', 'staging'], maxAgeHours: 72 },
  { id: 'G09', title: 'Interfaces y APIs reales', kinds: ['automated'], environments: ['ci', 'staging'], maxAgeHours: 72 },
  { id: 'G10', title: 'Calidad automatizada y móvil', kinds: ['automated', 'human'], environments: ['ci', 'staging'], maxAgeHours: 72 },
  { id: 'G11', title: 'Operación técnica', kinds: ['automated'], environments: ['disposable', 'staging'], maxAgeHours: 72 },
  { id: 'G12', title: 'Capacidad y costo', kinds: ['automated', 'human'], environments: ['staging'], maxAgeHours: 72 },
  { id: 'G13', title: 'Restauración y claves', kinds: ['automated', 'human'], environments: ['disposable'], maxAgeHours: 720 },
  { id: 'G14', title: 'Staging y proveedor', kinds: ['automated', 'provider'], environments: ['staging'], maxAgeHours: 72 },
  { id: 'G15', title: 'Autorización y operación de lanzamiento', kinds: ['human'], environments: ['production'], maxAgeHours: 72 },
  { id: 'G16', title: 'Resultados del piloto y mantenimiento', kinds: ['automated', 'human'], environments: ['production'], maxAgeHours: 72 }
]

export type ReleaseContext = {
  target: ReleaseTarget
  releaseId: string
  commit: string
  migrationSetHash: string
  environment: string
  now: number
  verifyArtifact: (evidence: Record<string, unknown>, gateId: string) => boolean
  verifyAttestation: (gateId: string, evidence: Record<string, unknown>) => boolean
}
export type ReleaseDecision = { canLaunch: boolean; canDemo: boolean; blockers: string[]; warnings: string[] }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0

/** A declarative boolean, including a legacy gate list, can never authorize release. */
export function evaluateReleaseGates(input: unknown, context?: ReleaseContext): ReleaseDecision {
  const blockers: string[] = []
  const warnings: string[] = []
  const result = () => ({ canLaunch: blockers.length === 0, canDemo: blockers.length === 0 && context?.target === 'technical', blockers, warnings })
  if (!context || !['technical', 'pilot', 'general'].includes(context.target) || !Number.isFinite(context.now) || !/^[a-f0-9]{40}$/.test(context.commit) || !/^[a-f0-9]{64}$/.test(context.migrationSetHash) || !text(context.releaseId) || !['staging', 'production'].includes(context.environment)) {
    blockers.push('Independent release context is required'); return result()
  }
  if (!object(input) || input.schemaVersion !== 1 || !Array.isArray(input.gates)) { blockers.push('Invalid manifest schema'); return result() }
  for (const key of ['releaseId', 'commit', 'migrationSetHash', 'environment'] as const) if (input[key] !== context[key]) blockers.push(`Manifest ${key} does not match candidate`)
  const seen = new Set<string>()
  for (const gate of input.gates) {
    if (!object(gate) || typeof gate.id !== 'string' || !RELEASE_GATE_CATALOG.some(item => item.id === gate.id) || seen.has(gate.id)) blockers.push('Unknown or duplicate gate')
    else seen.add(gate.id)
  }
  const requiredCount = { technical: 13, pilot: 15, general: 16 }[context.target]
  for (const [index, definition] of RELEASE_GATE_CATALOG.entries()) {
    const gate = input.gates.find(item => object(item) && item.id === definition.id)
    if (!object(gate)) { blockers.push(`${definition.id}: missing gate`); continue }
    if (!['pending', 'failed', 'skipped', 'passed'].includes(String(gate.status)) || !Array.isArray(gate.evidence)) { blockers.push(`${definition.id}: invalid status/evidence`); continue }
    if (gate.status !== 'passed') { (index < requiredCount ? blockers : warnings).push(`${definition.id}: ${gate.status}`); continue }
    const kinds = new Set<string>()
    const artifacts = new Set<string>()
    let valid = gate.evidence.length > 0
    for (const evidence of gate.evidence) {
      if (!object(evidence)) { valid = false; continue }
      for (const key of ['releaseId', 'commit', 'migrationSetHash', 'environment'] as const) if (evidence[key] !== context[key]) valid = false
      const date = typeof evidence.recordedAt === 'string' ? Date.parse(evidence.recordedAt) : NaN
      if (evidence.schemaVersion !== 1 || !Number.isFinite(date) || date > context.now || context.now - date > definition.maxAgeHours * 3_600_000 || evidence.exitCode !== 0 || !text(evidence.command) || !definition.environments.includes(String(evidence.executionEnvironment))) valid = false
      if (!definition.kinds.includes(evidence.kind as EvidenceKind)) valid = false
      kinds.add(String(evidence.kind))
      if (!object(evidence.artifact) || !text(evidence.artifact.path) || !/^[a-f0-9]{64}$/.test(String(evidence.artifact.sha256)) || artifacts.has(String(evidence.artifact.path))) valid = false
      else artifacts.add(String(evidence.artifact.path))
      if (!object(evidence.counts) || !Number.isInteger(evidence.counts.passed) || Number(evidence.counts.passed) <= 0 || evidence.counts.failed !== 0 || evidence.counts.skipped !== 0) valid = false
      try { if (!context.verifyArtifact(evidence, definition.id)) valid = false } catch { valid = false }
      if (!object(evidence.attestation) || !text(evidence.attestation.approver) || !text(evidence.attestation.reference) || !text(evidence.attestation.signature) || !text(evidence.attestation.keyId)) valid = false
      try { if (!context.verifyAttestation(definition.id, evidence)) valid = false } catch { valid = false }
    }
    if (!valid || definition.kinds.some(kind => !kinds.has(kind))) blockers.push(`${definition.id}: evidence missing, invalid, expired or unverified`)
  }
  return result()
}

/** Pending inventory only; it is deliberately not a releasable manifest. */
export const MVP_RELEASE_GATES = RELEASE_GATE_CATALOG.map(gate => ({ id: gate.id, status: 'pending', evidence: [] }))
