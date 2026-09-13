import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readTestIdentity } from './lib/test-environment.mjs'

const workdir = process.argv[2]
if (process.env.CI !== 'true' || !workdir) throw new Error('Explicit CI workdir required')
const identity = readTestIdentity({ LYSTO_TEST_IDENTITY_FILE: resolve(workdir, 'DISPOSABLE.json') })
if (identity.production !== false || identity.projectId !== 'lysto_integration_ci') throw new Error('Unexpected database identity')
const require = createRequire(import.meta.url)
const generated = execFileSync(process.execPath, [require.resolve('supabase/dist/supabase.js'), 'gen', 'types', 'typescript', '--local', '--schema', 'public', '--workdir', workdir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
mkdirSync('output/ci', { recursive: true })
writeFileSync('output/ci/database-types.generated.txt', generated)
const normalize = value => value.replaceAll('\r\n', '\n').trim()
if (normalize(generated) !== normalize(readFileSync('lib/supabase/database.types.ts', 'utf8'))) throw new Error('Database types drift from clean migrations')
console.log('Generated public database types match the candidate')
