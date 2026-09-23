begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(6);

select has_function('public','claim_professional_invitation_event',array['uuid','text','integer'],'A single invitation can be claimed for immediate delivery');
select ok(has_function_privilege('service_role','public.claim_professional_invitation_event(uuid,text,integer)','execute'),'Only the server role can claim an invitation');
select ok(not has_function_privilege('authenticated','public.claim_professional_invitation_event(uuid,text,integer)','execute'),'A signed-in user cannot claim an invitation');

insert into private.outbox_events(id,event_type,aggregate_type,aggregate_id,channel,recipient_key,dedupe_key,payload)
values
('bc000000-0000-4000-8000-000000000001','professional.invited','professional_invitation','bd000000-0000-4000-8000-000000000001','email','direct-one@example.test','direct-one','{}'),
('bc000000-0000-4000-8000-000000000002','professional.invited','professional_invitation','bd000000-0000-4000-8000-000000000002','email','direct-two@example.test','direct-two','{}');
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select count(*)::integer from public.claim_professional_invitation_event('bd000000-0000-4000-8000-000000000002','direct-test',120);
reset role;
select is((select attempt_count from private.outbox_events where id='bc000000-0000-4000-8000-000000000002'),1,'Only the requested invitation is claimed');
select is((select attempt_count from private.outbox_events where id='bc000000-0000-4000-8000-000000000001'),0,'Another invitation is not touched');
set local role service_role;
select count(*)::integer from public.claim_professional_invitation_event('bd000000-0000-4000-8000-000000000002','direct-test',120);
reset role;
select is((select attempt_count from private.outbox_events where id='bc000000-0000-4000-8000-000000000002'),1,'An active lease prevents duplicate sends');

select * from finish();
rollback;
