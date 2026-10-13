import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const sql = readFileSync('supabase/migrations/20261013141601_customer_hogar.sql', 'utf8')
describe('Hogar migration security boundaries', () => {
  it('defers only the revision-alias address constraint so full owner cascades can finish', () => {
    const aliases = sql.slice(sql.indexOf('create table public.customer_home_addresses'), sql.indexOf('create unique index customer_home_addresses_active_idx'))
    expect(aliases).toContain('foreign key(address_id,customer_id) references public.customer_addresses(id,customer_id) deferrable initially deferred')
    expect(aliases).not.toMatch(/references public\.customer_addresses[^;]*on delete cascade/)
    const homes = sql.slice(0, sql.indexOf('create index customer_homes_owner_idx'))
    expect(homes).toContain('foreign key(current_address_id,customer_id) references public.customer_addresses(id,customer_id)')
    expect(homes).not.toContain('deferrable')
  })
  it('indexes the full owned-home foreign key on address aliases', () => {
    expect(sql.includes('create index customer_home_addresses_home_idx on public.customer_home_addresses(home_id,customer_id);')).toBe(true)
    expect(sql.includes('foreign key(home_id,customer_id) references public.customer_homes(id,customer_id) on delete cascade')).toBe(true)
    expect(sql.includes('create unique index customer_home_addresses_active_idx on public.customer_home_addresses(customer_id,address_id) where archived_at is null;')).toBe(true)
  })
  it('initializes all seven layout identity arrays with their explicit PostgreSQL types', () => {
    // Actual isolated database lint warned SQLSTATE 42804 for text initializers.
    // The cast removes ambiguity without changing function contracts or ownership.
    for (const variable of ['v_ids', 'v_rooms', 'v_equipment', 'v_floor_ids', 'v_room_ids', 'v_equipment_ids'])
      expect(sql.includes(`${variable} uuid[]:='{}'::uuid[]`), variable).toBe(true)
    expect(sql.includes("v_orders integer[]:='{}'::integer[]")).toBe(true)
    expect(/\b(?:v_ids|v_rooms|v_equipment|v_orders|v_floor_ids|v_room_ids|v_equipment_ids) (?:uuid|integer)\[\]:='\{\}';/.test(sql)).toBe(false)
  })
  it('parenthesizes the CASE expression inside IF so branch THEN tokens cannot end its condition', () => {
    // Regression from isolated PostgreSQL startup: SQLSTATE 42601, statement 42.
    // This source guard supplements, but does not replace, the real migration gate.
    expect(/if not \(case v_kind[\s\S]*else false end\) then/.test(sql)).toBe(true)
    expect(/if not case v_kind/.test(sql)).toBe(false)
  })
  it('protects every exposed relation with owner SELECT and no direct mutation', () => {
    for (const table of ['customer_homes','customer_home_addresses','customer_home_floors','customer_home_rooms','customer_equipment_placements']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`on public.${table} for select to authenticated`)
    }
    expect(sql).toContain('revoke insert,update,delete')
    expect(sql).not.toContain('user_metadata')
  })
  it('keeps privileged routines private and empty search paths', () => {
    expect(sql).toContain('function private.write_customer_home')
    expect(sql).toContain('function public.write_customer_home')
    expect(sql).toMatch(/public\.write_customer_home[^;]+security invoker/s)
    expect(sql).toContain("security definer set search_path=''")
  })
  it('has explicit address-revision links, optimistic concurrency and idempotency', () => {
    expect(sql).toContain("v_result->>'replacedId'")
    expect(sql).toContain('customer_home_operations')
    expect(sql).toContain("errcode='40001'")
    expect(sql).not.toMatch(/update\s+public\.customer_equipment\s+set\s+address_id/i)
  })
  it('creates a new address in the same transaction and caches the original request', () => {
    expect(sql).toContain("private.write_customer_asset('address',null,null,p_data->'newAddress',false)")
    expect(sql).toContain('v_original_input')
    expect(sql).toContain("v_result:=v_result||jsonb_build_object('address',v_new_address)")
  })
  it('blocks archiving a current address while an active home depends on it', () => {
    expect(sql).toContain("message='Address linked to active home'")
    expect(sql).toMatch(/p_kind='address' and p_archive[\s\S]*current_address_id=p_id[\s\S]*archived_at is null/)
  })
  it('rejects the 501st active equipment placement before registering inventory', () => {
    const branch = sql.slice(sql.indexOf("if p_operation='equipment' then"), sql.indexOf("private.write_customer_asset_before_hogar('equipment'"))
    expect(branch).toContain('e.archived_at is null')
    expect(branch).toMatch(/count\(\*\)[\s\S]*>=500/)
    expect(branch).toContain("message='Home equipment limit reached'")
  })
  it('does not adopt another owner row through a UUID conflict race', () => {
    for (const table of ['customer_home_floors','customer_home_rooms','customer_equipment_placements']) {
      const start = sql.lastIndexOf(`insert into public.${table}`)
      const insert = sql.slice(start, sql.indexOf('v_affected_rows<>1', start) + 'v_affected_rows<>1'.length)
      expect(insert).toMatch(/where target\.home_id=excluded\.home_id and target\.customer_id=excluded\.customer_id;/)
      expect(insert).toMatch(/get diagnostics v_affected_rows=row_count;/)
    }
  })
})
