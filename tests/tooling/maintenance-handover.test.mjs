import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('progress reconciles all forty tasks without pending narrative completion', async () => {
  const progress = JSON.parse(await readFile(new URL('../../docs/plans/2026-09-10-production-progress.json', import.meta.url), 'utf8'))
  assert.equal(progress.tasks.length, 40)
  assert.deepEqual(progress.tasks.map(task => task.id), Array.from({ length: 40 }, (_, index) => `T${String(index).padStart(2, '0')}`))
  assert.equal(new Set(progress.tasks.map(task => task.id)).size, 40)
  assert.equal(progress.tasks.filter(task => task.status === 'pending').length, 0)
  assert.equal(progress.tasks.filter(task => task.status === 'verified').length, 11)
  assert.equal(progress.tasks.filter(task => task.status === 'implemented').length, 23)
  assert.equal(progress.tasks.filter(task => task.status === 'in_progress').length, 2)
  assert.equal(progress.tasks.filter(task => task.status === 'blocked_external').length, 4)
  assert.ok(progress.decisions.every(decision => decision.status === 'pending'))
  assert.ok(progress.releaseGates.every(gate => gate.status === 'pending'))
})

test('maintenance ownership covers every required operational domain and backup', async () => {
  const ownership = await readFile(new URL('../../docs/architecture/ownership-map.md', import.meta.url), 'utf8')
  for (const domain of ['Código y releases', 'Base y datos', 'Infraestructura', 'Pagos', 'Soporte y operación', 'Privacidad y legal']) {
    assert.match(ownership, new RegExp(`\\| ${domain.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')} \\|`))
  }
  assert.match(ownership, /Suplente requerido/)
  assert.match(ownership, /nunca secretos, códigos de recuperación o claves privadas/)
})

test('handover explicitly rejects production readiness without gates and pilot', async () => {
  const handover = await readFile(new URL('../../docs/release/production-handover.md', import.meta.url), 'utf8')
  assert.match(handover, /PRODUCCIÓN NO HABILITADA/)
  assert.match(handover, /11 tareas verificadas, 23 implementadas.*2 en progreso/s)
  assert.match(handover, /G01–G16 permanecen `pending`/)
  assert.match(handover, /cero diferencias monetarias inexplicadas/)
})
