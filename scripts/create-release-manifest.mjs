import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const GATES = [
  ['G01', 'Fuente reproducible'],
  ['G02', 'Dependencias y secretos'],
  ['G03', 'Base reproducible y permisos'],
  ['G04', 'Identidad y autorización'],
  ['G05', 'Alta y cuentas'],
  ['G06', 'Solicitud hasta asignación'],
  ['G07', 'Integridad financiera'],
  ['G08', 'Servicio y posventa'],
  ['G09', 'Interfaces y APIs reales'],
  ['G10', 'Calidad automatizada y móvil'],
  ['G11', 'Operación técnica'],
  ['G12', 'Capacidad y costo'],
  ['G13', 'Restauración y claves'],
  ['G14', 'Staging y proveedor'],
  ['G15', 'Autorización y operación de lanzamiento'],
  ['G16', 'Resultados del piloto y mantenimiento'],
]

export function hashMigrationSet(root) {
  const directory = resolve(root, 'supabase', 'migrations')
  const hash = createHash('sha256')
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    hash.update(name)
    hash.update('\0')
    hash.update(readFileSync(resolve(directory, name)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function buildReleaseManifest({ releaseId, environment, commit, migrationSetHash, createdAt = new Date().toISOString() }) {
  if (!releaseId?.trim()) throw new Error('releaseId is required')
  if (!['staging', 'production'].includes(environment)) throw new Error('environment must be staging or production')
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('commit must be a full git SHA')
  if (!/^[a-f0-9]{64}$/.test(migrationSetHash)) throw new Error('migrationSetHash must be SHA-256')
  return {
    schemaVersion: 1,
    releaseId,
    commit,
    migrationSetHash,
    environment,
    createdAt,
    decision: 'NO_GO',
    risks: [],
    exclusions: [],
    gates: GATES.map(([id, title]) => ({ id, title, status: 'pending', evidence: [] })),
  }
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const releaseId = argument('release-id')
  const environment = argument('environment')
  const outputArgument = argument('output')
  if (!outputArgument) throw new Error('--output is required')

  const output = resolve(root, outputArgument)
  const allowedRoot = resolve(root, 'output', 'release')
  const pathFromAllowedRoot = relative(allowedRoot, output)
  if (pathFromAllowedRoot.startsWith(`..${sep}`) || pathFromAllowedRoot === '..' || pathFromAllowedRoot === '' || resolve(output) === allowedRoot) {
    throw new Error('output must be a JSON file inside output/release')
  }
  if (!output.endsWith('.json')) throw new Error('output must be JSON')
  if (existsSync(output)) throw new Error('refusing to overwrite release manifest')

  const trackedChanges = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim()
  if (trackedChanges) throw new Error('tracked checkout must be clean before creating a release manifest')
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const manifest = buildReleaseManifest({ releaseId, environment, commit, migrationSetHash: hashMigrationSet(root) })
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  process.stdout.write(`${relative(root, output)}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
