begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('private','professional_policy_versions','draft and active requirements are versioned');
select has_table('private','professional_avatars','only server-finalized avatars count toward readiness');
select ok(not has_table_privilege('authenticated','private.professional_avatars','insert'),'browser cannot self-certify a public avatar');
select ok(not has_function_privilege('authenticated','public.set_professional_avatar(uuid,uuid,text,text,text)','execute'),'only the inspected server pipeline can finalize an avatar');
select ok(not has_function_privilege('anon','public.save_professional_policy_draft(uuid,jsonb)','execute'),'anonymous users cannot draft requirements');
select ok(not has_function_privilege('anon','public.activate_professional_policy(uuid,text,integer,text)','execute'),'anonymous users cannot approve requirements');
select ok(not has_function_privilege('anon','public.request_professional_revalidation(uuid,integer,text)','execute'),'anonymous users cannot reopen an approved dossier');
select ok(not has_function_privilege('authenticated','private.professional_ready_for_new_work(uuid)','execute'),'readiness helper cannot enumerate other users');
select ok(not (select prosecdef from pg_proc where oid='public.set_professional_avatar(uuid,uuid,text,text,text)'::regprocedure),
  'avatar RPC is an invoker wrapper around private privileged logic');
select ok(not (select prosecdef from pg_proc where oid='public.activate_professional_policy(uuid,text,integer,text)'::regprocedure),
  'policy activation RPC is an invoker wrapper around private privileged logic');
select is(private.professional_ready_for_new_work(gen_random_uuid()),false,'unknown professional is never ready');
select has_trigger('public','jobs','guard_new_professional_assignment','manual assignments are guarded');
select has_trigger('private','upload_intents','guard_professional_document_intent','document types follow the active policy');
select ok((select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='assignment_candidate_is_eligible') like '%professional_ready_for_new_work%',
  'candidate selection gates new work on readiness');
select is((select count(*) from private.professional_policy_versions where state='active'),
  (select count(*) from private.professional_review_policies where approved_at is not null and not test_only),
  'every active policy is an explicitly approved requirement, with no invented defaults');

set local role authenticated;
select throws_ok($$select public.save_professional_policy_draft(gen_random_uuid(),'{}'::jsonb)$$,'42501',null,
  'policy draft requires current operations MFA');
select throws_ok($$select public.activate_professional_policy(gen_random_uuid(),'v1',0,'A documented reason')$$,'42501',null,
  'policy approval requires current operations MFA');
reset role;

select * from finish();
rollback;
