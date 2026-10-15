-- Coordinate deployment with PT409-capable application error mappings.
-- PostgREST 14 retries custom SQLSTATE 40001 business conflicts indefinitely.
-- Change only the sixteen reviewed deliberate raises in these seven helpers.
-- Engine-generated serialization failures, prices, snapshots and data stay untouched.
do $business_conflicts$
declare
  v_scope jsonb := $targets$[
    {"signature":"private.write_customer_home(text,uuid,integer,jsonb)","manualCount":4,"preimages":["73ebec552dde32236d0f455ea8b7f2cf","a7c8006f61e2a4c825312842f85c736f"]},
    {"signature":"private.write_customer_asset_before_hogar(text,uuid,integer,jsonb,boolean)","manualCount":4,"preimages":["42bc64bcb4b1691d625a61d185a32f4c"]},
    {"signature":"private.customer_request_context_snapshot(uuid,jsonb)","manualCount":3,"preimages":["52c4142e70bec7463c544fa83cd4c5ad"]},
    {"signature":"private.persist_customer_request_preview(uuid,uuid,uuid,jsonb)","manualCount":1,"preimages":["46964363ec4ff05d223d64f5c6e19cf3"]},
    {"signature":"private.prepare_customer_request(uuid,uuid,uuid,uuid,uuid)","manualCount":2,"preimages":["0c39ef0e16e80dd93b53c6de8d0e622f"]},
    {"signature":"private.read_customer_request_preview(uuid,uuid,uuid,uuid,uuid)","manualCount":1,"preimages":["c58824985bb83bad4295aed8aa2dd31e"]},
    {"signature":"private.configure_customer_request_contract(uuid,jsonb,timestamp with time zone,integer,text,boolean)","manualCount":1,"preimages":["81fc3e3e2605311d11faad5f5de8ef1c"]}
  ]$targets$::jsonb;
  v_pattern constant text := 'errcode[[:space:]]*=[[:space:]]*''40001''';
  v_target record;
  v_oid oid;
  v_target_oids oid[] := '{}'::oid[];
  v_before pg_catalog.pg_proc%rowtype;
  v_after pg_catalog.pg_proc%rowtype;
  v_definition text;
  v_expected_definition text;
  v_expected_source text;
  v_count integer;
  v_non_target_before text;
  v_non_target_after text;
  v_security_before text;
  v_security_after text;
begin
  -- All identities must exist before the first CREATE OR REPLACE is attempted.
  for v_target in select * from jsonb_to_recordset(v_scope)
    as item(signature text,"manualCount" integer,preimages jsonb)
  loop
    v_oid:=to_regprocedure(v_target.signature);
    if v_oid is null then raise exception 'Business conflict helper missing: %',v_target.signature; end if;
    v_target_oids:=array_append(v_target_oids,v_oid);
  end loop;
  if cardinality(v_target_oids)<>7 or (select count(distinct target) from unnest(v_target_oids) target)<>7 then
    raise exception 'Business conflict helper scope changed';
  end if;

  select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]')::text)
  into v_non_target_before from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','private') and not(p.oid=any(v_target_oids));
  select md5(concat(
    (select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by n.nspname,c.relname),'[]')::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private')),
    (select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]')::text from pg_policies p where schemaname in('public','private')),
    (select coalesce(jsonb_agg(jsonb_build_array(rolname,rolsuper,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconfig) order by rolname),'[]')::text from pg_roles),
    (select coalesce(jsonb_agg(to_jsonb(m) order by roleid,member,grantor),'[]')::text from pg_auth_members m),
    (select coalesce(jsonb_agg(jsonb_build_array(nspname,nspowner,nspacl::text) order by nspname),'[]')::text from pg_namespace where nspname in('public','private'))))
  into v_security_before;

  for v_target in select * from jsonb_to_recordset(v_scope)
    as item(signature text,"manualCount" integer,preimages jsonb)
  loop
    v_oid:=to_regprocedure(v_target.signature);
    select * into strict v_before from pg_proc where oid=v_oid;
    v_definition:=pg_get_functiondef(v_oid);
    if v_before.pronamespace<>'private'::regnamespace or v_before.proowner<>'postgres'::regrole
      or not v_before.prosecdef or v_before.proconfig is distinct from array['search_path=""']::text[]
      or not exists(select 1 from jsonb_array_elements_text(v_target.preimages) expected where expected=md5(v_definition)) then
      raise exception 'Business conflict helper preimage changed: %',v_target.signature;
    end if;
    select count(*) into v_count from regexp_matches(v_before.prosrc,v_pattern,'g');
    if v_count<>v_target."manualCount" then
      raise exception 'Business conflict raise count changed: %',v_target.signature;
    end if;
    -- Preserve each exact approved original body, including its own line endings.
    v_expected_definition:=regexp_replace(v_definition,v_pattern,'errcode=''PT409''','g');
    v_expected_source:=regexp_replace(v_before.prosrc,v_pattern,'errcode=''PT409''','g');
    execute v_expected_definition;
    select * into strict v_after from pg_proc where oid=v_oid;
    if to_regprocedure(v_target.signature)::oid is distinct from v_oid
      or pg_get_functiondef(v_oid) is distinct from v_expected_definition
      or v_after.prosrc is distinct from v_expected_source
      or (to_jsonb(v_after)-'prosrc') is distinct from (to_jsonb(v_before)-'prosrc') then
      raise exception 'Business conflict helper changed beyond approved raises: %',v_target.signature;
    end if;
  end loop;

  select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]')::text)
  into v_non_target_after from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','private') and not(p.oid=any(v_target_oids));
  select md5(concat(
    (select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by n.nspname,c.relname),'[]')::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private')),
    (select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]')::text from pg_policies p where schemaname in('public','private')),
    (select coalesce(jsonb_agg(jsonb_build_array(rolname,rolsuper,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconfig) order by rolname),'[]')::text from pg_roles),
    (select coalesce(jsonb_agg(to_jsonb(m) order by roleid,member,grantor),'[]')::text from pg_auth_members m),
    (select coalesce(jsonb_agg(jsonb_build_array(nspname,nspowner,nspacl::text) order by nspname),'[]')::text from pg_namespace where nspname in('public','private'))))
  into v_security_after;
  if v_non_target_after is distinct from v_non_target_before or v_security_after is distinct from v_security_before then
    raise exception 'Business conflict migration changed unrelated bodies or privileges';
  end if;
end;
$business_conflicts$;
