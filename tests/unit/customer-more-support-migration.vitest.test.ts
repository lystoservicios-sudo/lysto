import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const sql = readFileSync('supabase/migrations/20261015014917_customer_support_public_replies.sql', 'utf8')
describe('Customer support reply migration safety', () => {
  it('retains existing function identity and access metadata via guarded CREATE OR REPLACE', () => {
    expect(sql).toContain('pg_get_functiondef')
    expect(sql).toContain('support_reply_preimage_mismatch')
    expect(sql).toContain('proacl')
    expect(sql.split('-- Customer replies')[0]).not.toMatch(/drop\s+function|grant\s+/i)
  })
  it('permits public information on open cases without granting staff decisions', () => {
    expect(sql).toContain("v_case.status in('open','in_review','waiting_professional') and p_action='customer_replied'")
    expect(sql).toContain('v_case.customer_id is distinct from private.current_customer_id()')
    expect(sql).toContain('v_case.professional_id is distinct from private.current_professional_id(false)')
    expect(sql).toContain('v_case.version is distinct from p_expected_version')
    expect(sql).toContain("errcode=''PT409''")
  })
  it('requires a completed owned service for new warranty submissions', () => {
    expect(sql).toContain("v_job.status is distinct from 'completed'")
    expect(sql).toContain('v_job.completed_at is null')
  })
  it('shares draft evidence only after it is linked to an authorized support case', () => {
    expect(sql).toContain('p_intent.attachment_id=any(e.evidence_ids)')
    expect(sql).toContain('coalesce(private.support_case_visible(c),false)')
    expect(sql).toContain('p_actor.id=private.current_profile_id()')
  })
  it('stores customer reply commands behind a private actor-locked authenticated entrypoint', () => {
    expect(sql).toContain('create function private.reply_customer_support_case')
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock')
    expect(sql).toContain("'operation','customer_support_reply'")
    expect(sql).toContain('return v_command.result')
    expect(sql.indexOf('return v_command.result')).toBeLessThan(sql.indexOf("v_result:=public.update_support_case"))
    expect(sql).toContain('language sql security invoker')
    expect(sql).toMatch(/grant execute[^;]+to authenticated;/)
    expect(sql).not.toMatch(/grant execute[^;]+to (anon|public|service_role)/)
  })
})
