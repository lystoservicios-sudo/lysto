import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const path = 'supabase/tests/hogar_owner_cleanup_rollback.sql'
const sql = existsSync(path) ? readFileSync(path, 'utf8') : ''

describe('Hogar owner cleanup SQL regression safety', () => {
  it('plans real owner cascades and isolated-address protection without an unavailable SET ROLE', () => {
    expect(sql).toMatch(/select plan\(8\);/i)
    expect(sql.match(/select lives_ok\(/gi)).toHaveLength(5)
    expect(sql.match(/select throws_ok\(/gi)).toHaveLength(2)
    for (const scenario of ['control', 'minimal', 'populated', 'revised', 'archived']) {
      expect(sql).toContain(`hogar_owner_cleanup_probe('${scenario}',false)`)
    }
    expect(sql).toContain("hogar_owner_cleanup_probe('minimal',true)")
    expect(sql).toContain("hogar_owner_cleanup_probe('revised',true)")
    expect(sql).toContain("'23503',null")
    expect(sql).toContain('condeferrable and condeferred')
    expect(sql).toMatch(/select \* from finish\(\);/i)
  })

  it('retains every synthetic insert and exact-owner delete inside a rollback-only transaction', () => {
    expect(sql).toMatch(/^begin;$/m)
    expect(sql.trim()).toMatch(/rollback;$/)
    expect(sql).toContain('delete from auth.users where id=v_user;')
    expect(sql).toContain("'hogar-owner-cleanup-'||v_user||'@example.invalid'")
    expect(sql).not.toMatch(/\bcommit;|\btruncate\b|\bdrop\b|disable\s+trigger|security\s+definer/i)
    expect(sql).toContain('delete from public.customer_addresses where id=v_current_address and customer_id=v_customer;')
    expect(sql).toContain('delete from public.customer_addresses where id=v_original_address and customer_id=v_customer;')
    expect(sql).toContain('if not p_delete_address_only then')
    expect(sql).not.toMatch(/delete from public\.(?!customer_addresses)/i)
  })

  it('leaves PostgreSQL deletion errors uncaught so pgTAP reports the original SQLSTATE and constraint', () => {
    expect(sql).toContain('create function pg_temp.hogar_owner_cleanup_probe')
    expect(sql).toMatch(/v_category uuid;\s*begin\b/)
    expect(sql).not.toMatch(/\bexception\s+when\b/i)
    expect(sql).not.toMatch(/set_config\('role'/)
    expect(sql).toContain('set constraints all immediate;')
  })

  it('exercises explicit revisions, equipment, placement and private operation dependencies', () => {
    for (const table of ['customer_home_addresses', 'customer_home_floors', 'customer_home_rooms', 'customer_equipment_placements', 'customer_home_operations']) {
      expect(sql).toMatch(new RegExp(`insert into (public|private)\\.${table}\\b`, 'i'))
    }
    expect(sql).toContain("case when p_scenario='revised' then v_original_address else v_current_address end")
    expect(sql).toContain("case when p_scenario='archived' then clock_timestamp() else null end")
  })
})
