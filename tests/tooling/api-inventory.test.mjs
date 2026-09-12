import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'

test('API inventory is regenerated and every method has authority, destination and test',()=>{
 execFileSync(process.execPath,['scripts/generate-api-inventory.mjs'])
 const inventory=JSON.parse(readFileSync('docs/architecture/api-inventory.json','utf8'))
 assert.ok(inventory.count>=36)
 assert.equal(inventory.entries.length,inventory.count)
 assert.equal(new Set(inventory.entries.map(e=>`${e.method} ${e.route}`)).size,inventory.count)
 for(const entry of inventory.entries){assert.ok(entry.authority);assert.ok(entry.canonicalDestination);assert.ok(entry.test)}
 const unsafe=inventory.entries.find(e=>e.route==='/api/payments/webhook/apply')
 assert.deepEqual({status:unsafe.status,destination:unsafe.canonicalDestination},{status:'retired',destination:'/api/mercadopago/webhook'})
})
