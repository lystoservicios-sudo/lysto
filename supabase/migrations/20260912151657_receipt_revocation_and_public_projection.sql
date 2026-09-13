create table private.receipt_token_events(
  id uuid primary key default gen_random_uuid(),receipt_id uuid not null references public.receipts(id) on delete cascade,
  action text not null check(action in('revoked','regenerated')),old_token_hash text not null,new_token_hash text,
  actor_profile_id uuid not null references public.profiles(id),reason text not null check(length(trim(reason)) between 10 and 1000),created_at timestamptz not null default clock_timestamp()
);
alter table private.receipt_token_events enable row level security;
alter table private.receipt_token_events force row level security;
revoke all on private.receipt_token_events from public,anon,authenticated,service_role;

drop function public.lookup_public_receipt(uuid);
drop function private.lookup_public_receipt(uuid);
drop view public.public_receipt_view;
create function public.lookup_public_receipt(p_token uuid)
returns table(service_name text,professional_name text,work_done text,final_state text,confirmation_status text,warranty_until date,next_maintenance_date date,issued_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception using errcode='42501',message='service_role_required';end if;
  return query select sc.name,coalesce(nullif(trim(concat_ws(' ',p.first_name,nullif(left(p.last_name,1),'')||'.')),''),'Profesional Lysto'),fr.work_done,fr.final_state,
    case j.status when 'completed_pending_customer_confirmation' then 'pending_confirmation' when 'completed' then 'confirmed' when 'disputed' then 'disputed' else 'unavailable' end,
    j.warranty_until,fr.next_maintenance_date,r.created_at
  from public.receipts r join public.jobs j on j.id=r.job_id join public.service_requests sr on sr.id=j.request_id join public.service_categories sc on sc.id=sr.category_id
    join public.job_final_reports fr on fr.id=r.final_report_id left join public.professional_profiles pp on pp.id=j.professional_id left join public.profiles p on p.id=pp.profile_id
  where r.public_token=p_token and r.revoked_at is null and r.expires_at>clock_timestamp() and j.status in('completed_pending_customer_confirmation','completed','disputed') limit 1;
end;$$;

create function public.manage_public_receipt_token(p_receipt_id uuid,p_expected_token uuid,p_action text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt public.receipts%rowtype;v_actor uuid:=private.current_profile_id();v_new uuid;v_old_hash text;
begin
  if not private.current_session_active(true) or not (private.has_admin_permission('operations') or private.has_admin_permission('quality')) then raise exception using errcode='42501',message='admin_mfa_required';end if;
  if p_action not in('revoke','regenerate') or length(trim(coalesce(p_reason,'')))<10 then raise exception using errcode='22023',message='invalid_receipt_action';end if;
  select * into v_receipt from public.receipts where id=p_receipt_id for update;
  if not found then raise exception using errcode='P0002',message='receipt_not_found';end if;
  if v_receipt.public_token<>p_expected_token then raise exception using errcode='40001',message='receipt_token_changed';end if;
  v_old_hash=encode(extensions.digest(convert_to(v_receipt.public_token::text,'UTF8'),'sha256'),'hex');
  if p_action='revoke' then
    if v_receipt.revoked_at is null then update public.receipts set revoked_at=clock_timestamp() where id=v_receipt.id;end if;
    insert into private.receipt_token_events(receipt_id,action,old_token_hash,actor_profile_id,reason) values(v_receipt.id,'revoked',v_old_hash,v_actor,trim(p_reason));
    perform private.append_admin_audit('receipt.revoked','receipt',v_receipt.id,jsonb_build_object('reason',trim(p_reason),'oldTokenHash',v_old_hash));
    return jsonb_build_object('receiptId',v_receipt.id,'status','revoked');
  end if;
  v_new=gen_random_uuid();update public.receipts set public_token=v_new,revoked_at=null,expires_at=clock_timestamp()+interval '90 days' where id=v_receipt.id;
  insert into private.receipt_token_events(receipt_id,action,old_token_hash,new_token_hash,actor_profile_id,reason) values(v_receipt.id,'regenerated',v_old_hash,encode(extensions.digest(convert_to(v_new::text,'UTF8'),'sha256'),'hex'),v_actor,trim(p_reason));
  perform private.append_admin_audit('receipt.regenerated','receipt',v_receipt.id,jsonb_build_object('reason',trim(p_reason),'oldTokenHash',v_old_hash));
  return jsonb_build_object('receiptId',v_receipt.id,'status','active','publicToken',v_new,'expiresAt',clock_timestamp()+interval '90 days');
end;$$;

revoke all on function public.lookup_public_receipt(uuid),public.manage_public_receipt_token(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.lookup_public_receipt(uuid) to service_role;
grant execute on function public.manage_public_receipt_token(uuid,uuid,text,text) to authenticated;
