-- Diagnostic pgTAP regression for disposable CI databases only.
-- Direct inserts isolate foreign-key cascades from the business RPCs, which
-- already have separate lifecycle coverage. Every identity is generated here.
-- No error is swallowed: lives_ok reports PostgreSQL's SQLSTATE, constraint
-- and context rather than replacing them with "fixture delete failed".
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
set local statement_timeout='30s';
select plan(8);

create function pg_temp.hogar_owner_cleanup_probe(p_scenario text,p_delete_address_only boolean)
returns void language plpgsql security invoker set search_path='' as $owner_cleanup$
declare
  v_user uuid:=gen_random_uuid(); v_session uuid:=gen_random_uuid();
  v_profile uuid:=gen_random_uuid(); v_customer uuid:=gen_random_uuid();
  v_original_address uuid:=gen_random_uuid(); v_current_address uuid;
  v_home uuid:=gen_random_uuid(); v_floor uuid:=gen_random_uuid();
  v_room uuid:=gen_random_uuid(); v_equipment uuid:=gen_random_uuid();
  v_category uuid;
begin
  if p_scenario not in ('control','minimal','populated','revised','archived') then
    raise exception 'Unknown synthetic owner-cleanup scenario';
  end if;
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(v_user,'hogar-owner-cleanup-'||v_user||'@example.invalid',clock_timestamp(),
      '{"app_role":"customer","signup_source":"hogar_owner_cleanup_rollback"}','{}',clock_timestamp(),clock_timestamp());
  insert into auth.sessions(id,user_id,created_at,updated_at,aal)
    values(v_session,v_user,clock_timestamp(),clock_timestamp(),'aal1');
  insert into public.profiles(id,auth_user_id,role,first_name,last_name,email,phone)
    values(v_profile,v_user,'customer','Hogar','Cleanup','hogar-owner-cleanup-'||v_user||'@example.invalid','1155551234');
  insert into public.customer_profiles(id,profile_id) values(v_customer,v_profile);
  insert into public.customer_addresses(id,customer_id,label,street,number,city,province,property_type,is_default,archived_at)
    values(v_original_address,v_customer,'Synthetic original','Synthetic cleanup street','1','CABA','CABA','house',false,
      case when p_scenario='revised' then clock_timestamp() else null end);
  v_current_address:=v_original_address;

  if p_scenario='revised' then
    v_current_address:=gen_random_uuid();
    insert into public.customer_addresses(id,customer_id,label,street,number,city,province,property_type,is_default)
      values(v_current_address,v_customer,'Synthetic revision','Synthetic cleanup street','2','CABA','CABA','house',false);
  end if;

  if p_scenario<>'control' then
    insert into public.customer_homes(id,customer_id,current_address_id,name,kind,building,balcony,terrace,windows,archived_at)
      values(v_home,v_customer,v_current_address,'Synthetic cleanup home','house',null,false,false,'large',
        case when p_scenario='archived' then clock_timestamp() else null end);
    insert into public.customer_home_floors(id,home_id,customer_id,name,sort_order)
      values(v_floor,v_home,v_customer,'Synthetic principal',0);
  end if;

  if p_scenario in ('populated','revised','archived') then
    insert into public.customer_home_addresses(home_id,customer_id,address_id,archived_at)
      values(v_home,v_customer,v_original_address,
        case when p_scenario='archived' then clock_timestamp() else null end);
    if p_scenario='revised' then
      insert into public.customer_home_addresses(home_id,customer_id,address_id)
        values(v_home,v_customer,v_current_address);
    end if;
    insert into public.customer_home_rooms(id,home_id,floor_id,customer_id,name,kind,variant,x,z,width,depth,rotation,windows)
      values(v_room,v_home,v_floor,v_customer,'Synthetic bedroom','bedroom','principal',0,0,4,4,0,'large');
    select id into strict v_category from public.service_categories where slug='aire_acondicionado';
    if not p_delete_address_only then
      insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type)
        values(v_equipment,v_customer,
          case when p_scenario='revised' then v_original_address else v_current_address end,
          v_category,'Synthetic cleanup air','split');
      -- Archival keeps inventory/floors/rooms, but clears location metadata.
      if p_scenario<>'archived' then
        insert into public.customer_equipment_placements(equipment_id,home_id,room_id,customer_id,wall,wall_offset,height)
          values(v_equipment,v_home,v_room,v_customer,'north',.5,2);
      end if;
    end if;
    insert into private.customer_home_operations(customer_id,idempotency_key,operation,input,result)
      values(v_customer,gen_random_uuid(),'create',jsonb_build_object('id',null,'data',jsonb_build_object('name','Synthetic cleanup home')),
        jsonb_build_object('home',jsonb_build_object('id',v_home)));
  end if;

  -- An isolated address DELETE must remain forbidden while its home survives,
  -- including when an alias constraint is initially deferred. Force its check
  -- here rather than certifying a transaction that never commits.
  if p_delete_address_only then
    if p_scenario='revised' then
      -- No equipment references the historical address in this probe, and the
      -- home points at its revision. Only the deferred alias FK can reject it.
      delete from public.customer_addresses where id=v_original_address and customer_id=v_customer;
    else
      delete from public.customer_addresses where id=v_current_address and customer_id=v_customer;
    end if;
    set constraints all immediate;
    raise exception 'Synthetic address deletion bypassed a live home dependency';
  end if;
  -- Only the generated owner's UUID is deleted. Real GoTrue-role cleanup is
  -- tested through Auth admin HTTP in integration, not an unavailable SET ROLE
  -- (the CI postgres executor cannot become supabase_auth_admin).
  delete from auth.users where id=v_user;

  if exists(select 1 from auth.users where id=v_user)
    or exists(select 1 from auth.sessions where id=v_session)
    or exists(select 1 from public.profiles where id=v_profile)
    or exists(select 1 from public.customer_profiles where id=v_customer)
    or exists(select 1 from public.customer_addresses where customer_id=v_customer)
    or exists(select 1 from public.customer_homes where customer_id=v_customer)
    or exists(select 1 from public.customer_home_addresses where customer_id=v_customer)
    or exists(select 1 from public.customer_home_floors where customer_id=v_customer)
    or exists(select 1 from public.customer_home_rooms where customer_id=v_customer)
    or exists(select 1 from public.customer_equipment where customer_id=v_customer)
    or exists(select 1 from public.customer_equipment_placements where customer_id=v_customer)
    or exists(select 1 from private.customer_home_operations where customer_id=v_customer) then
    raise exception 'Synthetic owner cleanup retained a dependent row in scenario %',p_scenario;
  end if;
end;
$owner_cleanup$;

select lives_ok($probe$select pg_temp.hogar_owner_cleanup_probe('control',false);$probe$,'SQL owner deletes a synthetic customer without Hogar');
select lives_ok($probe$select pg_temp.hogar_owner_cleanup_probe('minimal',false);$probe$,'SQL owner deletes a minimal active home and current address');
select lives_ok($probe$select pg_temp.hogar_owner_cleanup_probe('populated',false);$probe$,'SQL owner deletes a populated home with equipment, placement and private operation');
select lives_ok($probe$select pg_temp.hogar_owner_cleanup_probe('revised',false);$probe$,'SQL owner deletes linked address revisions without rewriting historical equipment');
select lives_ok($probe$select pg_temp.hogar_owner_cleanup_probe('archived',false);$probe$,'SQL owner deletes an archived home with retained inventory');
select throws_ok($probe$select pg_temp.hogar_owner_cleanup_probe('minimal',true);$probe$,'23503',null,'A current address cannot be deleted while its home survives');
select throws_ok($probe$select pg_temp.hogar_owner_cleanup_probe('revised',true);$probe$,'23503',null,'A historical address referenced only by an alias cannot bypass deferred checking');
select ok((select condeferrable and condeferred from pg_constraint where conrelid='public.customer_home_addresses'::regclass
  and conname='customer_home_addresses_address_id_customer_id_fkey'),'Only the alias dependency waits until owner cascades have finished');
select * from finish();
rollback;
