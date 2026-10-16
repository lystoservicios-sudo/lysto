import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const sql = readFileSync('supabase/migrations/20261015235743_professional_assigned_job_context.sql', 'utf8')
describe('assigned professional context database boundary', () => {
  it('places privileged reads in private and only an invoker wrapper in public', () => {
    expect(sql).toMatch(/function private\.read_professional_job_context\(p_job_id uuid\)[\s\S]*security definer set search_path=''/)
    expect(sql).toMatch(/function public\.read_professional_job_context\(p_job_id uuid\)[\s\S]*security invoker set search_path=''/)
    expect(sql).toContain('from public,anon,authenticated,service_role')
    expect(sql).toContain('to authenticated;')
  })
  it('rechecks fresh operational authority and exact assignment rather than metadata or caller identities', () => {
    expect(sql).toContain('private.current_professional_id(true)')
    expect(sql).toContain('j.id=p_job_id and j.professional_id=v_professional')
    expect(sql).not.toContain('user_metadata')
    expect(sql).not.toContain('p_customer_id')
    expect(sql).not.toContain('p_professional_id')
  })
  it('uses the contracted visit address and only the related home and assigned placement', () => {
    expect(sql).toContain('v_request.visit_address_id')
    expect(sql).toContain("v_request.visit_address_snapshot->>'reference'")
    expect(sql).toContain("v_request.context_snapshot->'home'->>'id'")
    expect(sql).toContain('h.customer_id=v_job.customer_id')
    expect(sql).toContain('p.equipment_id=v_request.equipment_id')
    expect(sql).toContain("'addressId',v_visit_address")
    expect(sql).not.toContain('private.customer_home_document(')
  })
  it('has no writes, no general inventory and no legacy payment approval fallback', () => {
    expect(sql).not.toMatch(/\b(insert into|update public|delete from|grant (?:insert|update|delete))\b/i)
    expect(sql).not.toMatch(/\bpublic\.payments\b/)
    expect(sql).toContain('public.marketplace_checkouts')
    expect(sql).toContain('c.extra_id is null')
    expect(sql).toContain('c.extra_id is not null')
    expect(sql).toContain('limit 50')
  })
  it('returns only verified request photo attachment IDs with matching stored objects', () => {
    expect(sql).toContain("i.entity_id=v_request.id and i.kind='request-photo' and i.status='verified'")
    expect(sql).toContain('m.request_id=v_request.id')
    expect(sql).toContain('i.attachment_id=m.id')
    expect(sql).toContain('storage.objects')
    expect(sql).toContain('limit 10')
  })
})
