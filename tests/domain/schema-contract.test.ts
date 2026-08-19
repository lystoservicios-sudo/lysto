import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../_lib/test.ts'
import { findDuplicateMigrationVersions, findMissingRls, findMissingTables } from '../../lib/db/schema-contract.ts'

const migrationsDir = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
const sql = files.map((name) => readFileSync(join(migrationsDir, name), 'utf8')).join('\n')

test('migraciones no tienen versiones duplicadas', () => {
  expect(findDuplicateMigrationVersions(files).length).toBe(0)
})

test('schema contiene tablas obligatorias del MVP operativo', () => {
  const missing = findMissingTables(sql)
  expect(missing).toEqual([])
})

test('tablas sensibles tienen RLS habilitado', () => {
  const missing = findMissingRls(sql)
  expect(missing).toEqual([])
})
