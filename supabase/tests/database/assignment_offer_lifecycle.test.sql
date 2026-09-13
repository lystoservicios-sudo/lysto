begin;
select plan(16);

select has_table('public','assignment_offers','assignment offers are persisted');
select has_column('public','jobs','assignment_version','assignment uses optimistic versioning');
select col_not_null('public','jobs','assignment_version','assignment version cannot be null');
select has_function('public','list_assignment_candidates',array['uuid','timestamp with time zone','integer','integer'],'candidate query exists');
select has_function('public','create_assignment_offer',array['uuid','uuid','timestamp with time zone','integer','integer','timestamp with time zone','integer'],'offer transaction exists');
select has_function('public','respond_assignment_offer',array['uuid','text','text','integer'],'response transaction exists');
select has_function('public','expire_assignment_offers',array['integer'],'expiry worker exists');
select function_privs_are('public','create_assignment_offer',array['uuid','uuid','timestamp with time zone','integer','integer','timestamp with time zone','integer'],'authenticated',array['EXECUTE'],'authenticated boundary can create offers');
select function_privs_are('public','respond_assignment_offer',array['uuid','text','text','integer'],'authenticated',array['EXECUTE'],'authenticated boundary can respond');
select ok((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='assignment_offers'),'assignment offer RLS enabled');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='assignment_offers' and policyname='assignment_offer_participant_read'),'participants have a read policy');
select ok((select count(*)=1 from pg_indexes where schemaname='public' and indexname='assignment_offer_one_pending'),'only one pending offer exists per job');
select has_trigger('public','jobs','marketplace_assignment_guard','paid destination guard remains installed');
select ok((select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_assignment_offer') like '%private.assignment_candidate_is_eligible%','transaction rechecks eligibility');
select ok((select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_assignment_offer') like '%private.insert_schedule_reservation%','offer reserves verified capacity');
select ok((select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='respond_assignment_offer') like '%private.professional_respond_to_job%','response reuses canonical job transition');

select * from finish();
rollback;
