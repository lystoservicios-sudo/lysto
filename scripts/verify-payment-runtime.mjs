import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { TokenCipher, createMercadoPagoSplit, parseSellerId } from '@waltergaltieri/mercadopago-split'
import { createPrismaClient, PrismaStorage } from '@waltergaltieri/mercadopago-split/prisma'

// No provider requests, real credentials, or database connections are made.
assert.equal(typeof createMercadoPagoSplit, 'function')
assert.equal(typeof PrismaStorage, 'function')
assert.equal(parseSellerId('runtime-test-seller'), 'runtime-test-seller')
const cipher = new TokenCipher(randomBytes(32).toString('base64'))
const context = { sellerId: 'runtime-test-seller', tokenType: 'access' }
const encrypted = cipher.encrypt('synthetic-runtime-token', context)
assert.equal(cipher.decrypt(encrypted, context), 'synthetic-runtime-token')
assert.throws(() => cipher.decrypt(encrypted, { ...context, sellerId: 'different-seller' }))

// Instantiation resolves the generated Prisma runtime. DB operations are tested
// separately against a disposable database; this smoke does not claim to do so.
const prisma = createPrismaClient('postgresql://synthetic:synthetic@127.0.0.1:1/runtime_smoke')
try {
  assert.equal(typeof prisma.$transaction, 'function')
  assert.equal(typeof prisma.connectedAccount.findMany, 'function')
} finally {
  await prisma.$disconnect()
}
console.log(JSON.stringify({ status: 'passed', node: process.version, platform: process.platform, checks: ['package-exports', 'token-roundtrip', 'token-context-isolation', 'prisma-initialization'], databaseQueries: 0, providerRequests: 0 }))
