import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

// CI creates a new project outside the checkout. This script never resets an existing database.
const root = resolve(process.cwd())
const workdir = resolve(process.argv[2] ?? '')
const relativePath = relative(root, workdir)
if (process.env.CI !== 'true' || !process.argv[2] || (!isAbsolute(relativePath) && relativePath !== '..' && !relativePath.startsWith(`..${sep}`)) || existsSync(workdir)) throw new Error('CI requires a new disposable directory outside the checkout')
mkdirSync(join(workdir, 'supabase'), { recursive: true })
for (const path of ['migrations', 'tests', 'seed.sql']) cpSync(join(root, 'supabase', path), join(workdir, 'supabase', path), { recursive: true })
// Auth email templates are added by T07; preserve them when available.
if (existsSync(join(root, 'supabase', 'templates'))) cpSync(join(root, 'supabase', 'templates'), join(workdir, 'supabase', 'templates'), { recursive: true })
const source = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8')
const config = source.replace(/^project_id\s*=.*$/m, 'project_id = "lysto_integration_ci"').replace(/^port = 55321$/m, 'port = 54321').replace(/^port = 55322$/m, 'port = 54322').replace(/^port = 55323$/m, 'port = 54323')
writeFileSync(join(workdir, 'supabase', 'config.toml'), config)
writeFileSync(join(workdir, 'DISPOSABLE.json'), JSON.stringify({ production: false, purpose: 'T33 isolated CI integration', projectId: 'lysto_integration_ci', databasePort: 54322, apiPort: 54321 }, null, 2))
console.log('Prepared disposable CI project; production credentials are not used')
