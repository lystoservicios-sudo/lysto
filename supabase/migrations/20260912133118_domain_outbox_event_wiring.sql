-- Persist notification intent in the same transaction as each business change.
create function private.enqueue_profile_delivery(
  p_event_type text,p_aggregate_type text,p_aggregate_id uuid,p_profile_id uuid,
  p_channels text[],p_dedupe_key text
) returns void language plpgsql security definer set search_path='' as $$
declare v_channel text;v_email text;
begin
  if p_profile_id is null or p_channels is null or cardinality(p_channels)=0
    or not(p_channels<@array['in_app','email']::text[]) then return; end if;
  select email::text into v_email from public.profiles where id=p_profile_id;
  if not found then return; end if;
  foreach v_channel in array p_channels loop
    insert into private.outbox_events(event_type,aggregate_type,aggregate_id,channel,recipient_profile_id,recipient_key,dedupe_key,payload)
    values(p_event_type,p_aggregate_type,p_aggregate_id,v_channel,p_profile_id,
      case when v_channel='email' then lower(v_email) else p_profile_id::text end,p_dedupe_key,'{}'::jsonb)
    on conflict(channel,recipient_key,dedupe_key) do nothing;
  end loop;
end; $$;
revoke all on function private.enqueue_profile_delivery(text,text,uuid,uuid,text[],text) from public,anon,authenticated,service_role;

create function private.enqueue_admin_delivery(
  p_event_type text,p_aggregate_type text,p_aggregate_id uuid,p_permission public.admin_permission,p_dedupe_key text
) returns void language plpgsql security definer set search_path='' as $$
declare v_profile uuid;
begin
  for v_profile in select a.profile_id from public.admin_profiles a
    where exists(select 1 from private.admin_profile_permissions g where g.admin_profile_id=a.id and g.permission in(p_permission,'owner'))
  loop perform private.enqueue_profile_delivery(p_event_type,p_aggregate_type,p_aggregate_id,v_profile,array['in_app'],p_dedupe_key); end loop;
end; $$;
revoke all on function private.enqueue_admin_delivery(text,text,uuid,public.admin_permission,text) from public,anon,authenticated,service_role;

create function private.notify_quote_ready() returns trigger language plpgsql security definer set search_path='' as $$
declare v_profile uuid;v_key text:=gen_random_uuid()::text;
begin
  if new.status='ready' and new.status is distinct from old.status then
    select profile_id into v_profile from public.customer_profiles where id=new.customer_id;
    perform private.enqueue_profile_delivery('quote.ready','quote',new.id,v_profile,array['in_app','email'],v_key);
    perform private.enqueue_admin_delivery('quote.ready','quote',new.id,'operations',v_key);
  end if; return new;
end; $$;
create trigger quote_ready_notification after update of status on public.service_quotes for each row execute function private.notify_quote_ready();

create function private.notify_request_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_profile uuid;v_event text;v_key text:=gen_random_uuid()::text;
begin
  if tg_op='INSERT' and new.status<>'draft' then v_event='request.created';
  elsif tg_op='UPDATE' and new.status='cancelled' and new.status is distinct from old.status then v_event='request.cancelled';
  else return new; end if;
  select profile_id into v_profile from public.customer_profiles where id=new.customer_id;
  perform private.enqueue_profile_delivery(v_event,'request',new.id,v_profile,array['in_app','email'],v_key);
  perform private.enqueue_admin_delivery(v_event,'request',new.id,'operations',v_key);
  return new;
end; $$;
create trigger request_notification after insert or update of status on public.service_requests for each row execute function private.notify_request_change();

create function private.notify_job_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_customer_profile uuid;v_professional_profile uuid;v_event text;v_key text:=gen_random_uuid()::text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_event=case new.status
    when 'pending_professional_acceptance' then 'job.assigned'
    when 'confirmed' then 'job.confirmed'
    when 'technician_on_way' then 'job.technician_on_way'
    when 'arrived' then 'job.arrived'
    when 'completed_pending_customer_confirmation' then 'job.completed_pending_customer_confirmation'
    when 'completed' then 'job.completed' else null end;
  if v_event is null then return new; end if;
  select profile_id into v_customer_profile from public.customer_profiles where id=new.customer_id;
  if new.professional_id is not null then select profile_id into v_professional_profile from public.professional_profiles where id=new.professional_id; end if;
  perform private.enqueue_profile_delivery(v_event,'job',new.id,v_customer_profile,
    case when new.status in('confirmed','completed_pending_customer_confirmation') then array['in_app','email'] else array['in_app'] end,v_key);
  perform private.enqueue_profile_delivery(v_event,'job',new.id,v_professional_profile,
    case when new.status='pending_professional_acceptance' then array['in_app','email'] else array['in_app'] end,v_key);
  perform private.enqueue_admin_delivery(v_event,'job',new.id,'operations',v_key);
  return new;
end; $$;
create trigger job_notification after update of status on public.jobs for each row execute function private.notify_job_change();

create function private.notify_payment_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_profile uuid;v_event text;v_key text:=gen_random_uuid()::text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  v_event=case when new.status in('approved','captured') then 'payment.approved'
    when new.status in('rejected','failed','cancelled') then 'payment.failed'
    when new.status in('refunded','partially_refunded') then 'payment.refunded' else null end;
  if v_event is null then return new; end if;
  select profile_id into v_profile from public.customer_profiles where id=new.customer_id;
  perform private.enqueue_profile_delivery(v_event,'payment',new.id,v_profile,array['in_app','email'],v_key);
  perform private.enqueue_admin_delivery(v_event,'payment',new.id,'finance',v_key);
  return new;
end; $$;
create trigger payment_notification after insert or update of status on public.payments for each row execute function private.notify_payment_change();

create function private.notify_support_opened() returns trigger language plpgsql security definer set search_path='' as $$
declare v_customer_profile uuid;v_professional_profile uuid;v_key text:=gen_random_uuid()::text;
begin
  select profile_id into v_customer_profile from public.customer_profiles where id=new.customer_id;
  if new.professional_id is not null then select profile_id into v_professional_profile from public.professional_profiles where id=new.professional_id; end if;
  perform private.enqueue_profile_delivery('support.opened','complaint',new.id,v_customer_profile,array['in_app','email'],v_key);
  perform private.enqueue_profile_delivery('support.opened','complaint',new.id,v_professional_profile,array['in_app'],v_key);
  perform private.enqueue_admin_delivery('support.opened','complaint',new.id,'quality',v_key);
  return new;
end; $$;
create trigger support_opened_notification after insert on public.complaints for each row execute function private.notify_support_opened();

revoke all on function private.notify_quote_ready(),private.notify_request_change(),private.notify_job_change(),
  private.notify_payment_change(),private.notify_support_opened() from public,anon,authenticated,service_role;
