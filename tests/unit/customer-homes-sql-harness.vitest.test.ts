import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/tests/hogar_rollback.sql', 'utf8')
describe('Hogar SQL CI harness contract', () => {
  it('emits a planned pgTAP suite rather than NOTICE-only output for pg_prove', () => {
    expect(sql).toMatch(/create extension if not exists pgtap with schema extensions/i)
    expect(sql).toMatch(/select plan\(\d+\);/i)
    expect(sql).toMatch(/select ok\(/i)
    expect(sql).toMatch(/select lives_ok\(\$hogar_qa\$/i)
    expect(sql).toMatch(/select \* from finish\(\);/i)
  })
  it('keeps the synthetic lifecycle checks inside one rollback-only invoker execution', () => {
    expect(sql).toMatch(/^begin;$/m)
    expect(sql.trim()).toMatch(/rollback;$/)
    expect(sql).not.toMatch(/\bcommit;/i)
    expect(sql).toContain("perform set_config('role','authenticated',true)")
    expect(sql).toContain("perform set_config('role',owner_role,true)")
    for (const message of ['QA cross-owner read leak','QA stale version accepted','QA failed home left an orphan address','QA foreign floor adopted','QA equipment historical address changed','QA active home address was archived','QA duplicate equipment','QA 501st registration was not atomic','QA archived equipment incorrectly consumes capacity']) expect(sql).toContain(message)
  })
})
