import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('pilot report cannot imply elapsed time or completed sample', async () => {
  const report = await readFile(new URL('../../docs/release/pilot-report.md', import.meta.url), 'utf8')
  assert.match(report, /Estado: \*\*no iniciado\*\*/)
  assert.match(report, /20 servicios completos durante al menos 14 días/)
  assert.match(report, /Diferencia monetaria inexplicada \| 0/)
  assert.match(report, /Incidentes críticos abiertos \| 0/)
  assert.match(report, /Resultado: \*\*PENDIENTE\*\*/)
  assert.match(report, /no acredita GENERAL_PRODUCTION_READY/)
})

test('pilot defects define stop conditions and verified closure', async () => {
  const defects = await readFile(new URL('../../docs/release/pilot-defects.md', import.meta.url), 'utf8')
  assert.match(defects, /S0 bloqueante/)
  assert.match(defects, /cerrar solicitudes y checkouts/)
  assert.match(defects, /Sólo `verified` acredita una corrección cerrada/)
  assert.match(defects, /cero S0\/S1 abiertos/)
})
