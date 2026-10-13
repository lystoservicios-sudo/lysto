import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROOM_CATALOG } from '@/lib/customer-homes/contracts'

const path = 'supabase/tests/hogar_catalogue_rollback.sql'
const sql = existsSync(path) ? readFileSync(path, 'utf8') : ''

describe('Hogar catalogue database fixture source agreement', () => {
  it('contains every client room, variant and compatible home kind without an independent catalogue', () => {
    const fixture = sql.match(/\$room_catalog\$([\s\S]*?)\$room_catalog\$::jsonb/)
    expect(fixture, 'The pgTAP catalogue fixture must exist').not.toBeNull()
    const actual = fixture ? JSON.parse(fixture[1]) : []
    const expected = Object.entries(ROOM_CATALOG).map(([kind, config]) => ({
      kind, variants: config.variants.map(variant => variant.value), home_kinds: config.homeKinds
    }))
    expect(actual).toEqual(expected)
    expect(expected.flatMap(room => room.variants)).toHaveLength(37)
  })

  it('runs the private validator as postgres with a computed plan and useful exception assertions', () => {
    expect(sql).toContain('set local role postgres;')
    expect(sql).toContain('select plan((select count(*)::integer from pg_temp.hogar_catalogue_cases));')
    expect(sql).toContain('private.validate_home_layout(%L::jsonb)')
    expect(sql).toContain('lives_ok(command, description)')
    expect(sql).toContain("throws_ok(command, '22023', null, description)")
    for (const category of ['compatible', 'invalid_variant', 'incompatible', 'disabled_exterior'])
      expect(sql).toContain(`'${category}'`)
    expect(sql).toContain("not (catalogue.home_kinds ? home.kind)")
    expect(sql).toContain("catalogue.kind <> 'balcony'")
    expect(sql).toContain("catalogue.kind <> 'terrace'")
  })

  it('keeps synthetic single-room cases in temporary tables inside BEGIN/ROLLBACK only', () => {
    expect(sql).toMatch(/\bbegin;/i)
    expect(sql.trim()).toMatch(/select \* from finish\(\);\s*rollback;$/i)
    expect(sql).toContain('create temporary table hogar_catalogue')
    expect(sql).toContain('create temporary table hogar_catalogue_cases')
    expect(sql.match(/on commit drop/g)).toHaveLength(2)
    expect(sql).toContain("'addressId', gen_random_uuid()")
    expect(sql).toContain("'floors', jsonb_build_array(jsonb_build_object(")
    expect(sql).toContain("'rooms', jsonb_build_array(jsonb_build_object(")
    expect(sql).not.toMatch(/\b(?:insert\s+into|update|delete\s+from|truncate|drop\s+table)\s+(?:public|auth|private)\./i)
    expect(sql).not.toContain('write_customer_home')
    expect(sql).not.toContain('write_customer_asset')
  })
})
