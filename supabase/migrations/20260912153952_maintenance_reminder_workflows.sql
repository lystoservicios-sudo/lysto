create table public.maintenance_plans(
 id uuid primary key default gen_random_uuid(),equipment_id uuid not null references public.customer_equipment(id) on delete cascade,
 customer_id uuid not null references public.customer_profiles(id) on delete cascade,source_service_record_id uuid unique references public.equipment_service_records(id) on delete restrict,
 source_job_id uuid references public.jobs(id) on delete set null,recommendation public.maintenance_option not null,due_date date,
 status text not null check(status in('planned','deferred','suppressed_by_case','requested','completed','cancelled')),
 version integer not null default 1 check(version>0),requested_service_request_id uuid references public.service_requests(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check((recommendation='none' and due_date is null and status='cancelled') or recommendation<>'none')
);
create unique index maintenance_one_current_per_equipment on public.maintenance_plans(equipment_id) where status in('planned','deferred','suppressed_by_case','requested');
create index maintenance_customer_due on public.maintenance_plans(customer_id,status,due_date);
alter table public.maintenance_plans enable row level security;
revoke all on public.maintenance_plans from public,anon,authenticated,service_role;
grant select(id,equipment_id,source_service_record_id,source_job_id,recommendation,due_date,status,version,requested_service_request_id,created_at,updated_at) on public.maintenance_plans to authenticated;
create policy maintenance_customer_read on public.maintenance_plans for select to authenticated using(customer_id=private.current_customer_id() or private.has_admin_permission('operations') or private.has_admin_permission('quality'));

create table public.customer_contact_preferences(customer_id uuid primary key references public.customer_profiles(id) on delete cascade,email_enabled boolean not null default true,in_app_enabled boolean not null default true,commercial_reminders_enabled boolean not null default false,updated_at timestamptz not null default clock_timestamp());
alter table public.customer_contact_preferences enable row level security;
revoke all on public.customer_contact_preferences from public,anon,authenticated,service_role;
grant select(customer_id,email_enabled,in_app_enabled,commercial_reminders_enabled,updated_at) on public.customer_contact_preferences to authenticated;
create policy contact_preferences_owner_read on public.customer_contact_preferences for select to authenticated using(customer_id=private.current_customer_id());

create table private.maintenance_reminders(
 id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.maintenance_plans(id) on delete cascade,scheduled_for date not null,channel text not null check(channel in('in_app','email','manual')),
 status text not null default 'pending' check(status in('pending','claimed','delivered','failed','cancelled')),dedupe_key text not null unique,attempt_count integer not null default 0,
 provider_message_id text,last_error text,delivered_at timestamptz,created_at timestamptz not null default clock_timestamp(),unique(plan_id,scheduled_for,channel)
);
alter table private.maintenance_reminders enable row level security;alter table private.maintenance_reminders force row level security;revoke all on private.maintenance_reminders from public,anon,authenticated,service_role;

create function private.maintenance_due_date(p_option public.maintenance_option,p_from date) returns date language sql immutable set search_path='' as $$select case p_option when 'filters_30_days' then p_from+30 when 'filters_60_days' then p_from+60 when 'filters_90_days' then p_from+90 when 'deep_cleaning_6_months' then (p_from+interval '6 months')::date when 'deep_cleaning_annual' then (p_from+interval '1 year')::date when 'gas_review_30_days' then p_from+30 when 'outdoor_unit_review' then p_from+30 when 'electrical_review' then p_from+15 when 'pending_part_replacement' then p_from+7 when 'second_visit_recommended' then p_from+7 else null end;$$;

create function private.sync_maintenance_plan() returns trigger language plpgsql security definer set search_path='' as $$
declare v_customer uuid;v_archived timestamptz;v_open_case boolean;v_status text;v_due date;
begin
 select e.customer_id,e.archived_at into v_customer,v_archived from public.customer_equipment e where e.id=new.equipment_id;
 v_due=private.maintenance_due_date(new.next_maintenance_option,new.created_at::date);
 if new.next_maintenance_option='none' then return new;end if;
 v_open_case=exists(select 1 from public.complaints c where c.job_id=new.job_id and c.category in('quality','warranty') and c.status in('open','in_review','waiting_customer','waiting_professional'));
 v_status=case when v_archived is not null then 'cancelled' when v_open_case then 'suppressed_by_case' else 'planned' end;
 insert into public.maintenance_plans(equipment_id,customer_id,source_service_record_id,source_job_id,recommendation,due_date,status)
 values(new.equipment_id,v_customer,new.id,new.job_id,new.next_maintenance_option,v_due,v_status)
 on conflict(equipment_id) where status in('planned','deferred','suppressed_by_case','requested') do update set source_service_record_id=excluded.source_service_record_id,source_job_id=excluded.source_job_id,recommendation=excluded.recommendation,due_date=excluded.due_date,status=excluded.status,version=public.maintenance_plans.version+1,updated_at=clock_timestamp();
 update private.maintenance_reminders set status='cancelled' where plan_id=(select id from public.maintenance_plans where equipment_id=new.equipment_id and status in('planned','deferred','suppressed_by_case','requested')) and status='pending' and scheduled_for is distinct from v_due;
 if v_status='planned' and v_due is not null then insert into private.maintenance_reminders(plan_id,scheduled_for,channel,dedupe_key) select p.id,v_due,case when coalesce(cp.in_app_enabled,true) then 'in_app' else 'manual' end,'maintenance:'||p.id||':'||v_due from public.maintenance_plans p left join public.customer_contact_preferences cp on cp.customer_id=p.customer_id where p.equipment_id=new.equipment_id and p.status='planned' on conflict(dedupe_key) do nothing;end if;
 return new;
end;$$;
create trigger equipment_service_record_maintenance after insert on public.equipment_service_records for each row execute function private.sync_maintenance_plan();

insert into public.maintenance_plans(equipment_id,customer_id,source_service_record_id,source_job_id,recommendation,due_date,status)
select r.equipment_id,e.customer_id,r.id,r.job_id,r.next_maintenance_option,private.maintenance_due_date(r.next_maintenance_option,r.created_at::date),case when e.archived_at is not null then 'cancelled' when exists(select 1 from public.complaints c where c.job_id=r.job_id and c.category in('quality','warranty') and c.status in('open','in_review','waiting_customer','waiting_professional')) then 'suppressed_by_case' else 'planned' end
from public.equipment_service_records r join public.customer_equipment e on e.id=r.equipment_id where r.next_maintenance_option<>'none' and not exists(select 1 from public.maintenance_plans p where p.equipment_id=r.equipment_id);
insert into private.maintenance_reminders(plan_id,scheduled_for,channel,dedupe_key) select p.id,p.due_date,case when coalesce(cp.in_app_enabled,true) then 'in_app' else 'manual' end,'maintenance:'||p.id||':'||p.due_date from public.maintenance_plans p left join public.customer_contact_preferences cp on cp.customer_id=p.customer_id where p.status='planned' and p.due_date is not null on conflict(dedupe_key) do nothing;

create function private.sync_maintenance_suppression() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plan public.maintenance_plans%rowtype;v_blocked boolean;
begin
 if new.category not in('quality','warranty') or new.job_id is null then return new;end if;
 v_blocked=new.status in('open','in_review','waiting_customer','waiting_professional');
 for v_plan in select * from public.maintenance_plans where source_job_id=new.job_id and status in('planned','deferred','suppressed_by_case') for update loop
  update public.maintenance_plans set status=case when v_blocked then 'suppressed_by_case' else 'planned' end,version=version+1,updated_at=clock_timestamp() where id=v_plan.id;
  if v_blocked then update private.maintenance_reminders set status='cancelled' where plan_id=v_plan.id and status='pending';
  elsif v_plan.due_date is not null then insert into private.maintenance_reminders(plan_id,scheduled_for,channel,dedupe_key) values(v_plan.id,v_plan.due_date,'in_app','maintenance:'||v_plan.id||':'||v_plan.due_date) on conflict(dedupe_key) do update set status=case when private.maintenance_reminders.status='cancelled' then 'pending' else private.maintenance_reminders.status end;end if;
 end loop;return new;
end;$$;
create trigger complaint_maintenance_suppression after insert or update of status on public.complaints for each row execute function private.sync_maintenance_suppression();

create function private.sync_archived_equipment_maintenance() returns trigger language plpgsql security definer set search_path='' as $$begin if new.archived_at is not null and old.archived_at is null then update public.maintenance_plans set status='cancelled',version=version+1,updated_at=clock_timestamp() where equipment_id=new.id and status in('planned','deferred','suppressed_by_case');update private.maintenance_reminders set status='cancelled' where plan_id in(select id from public.maintenance_plans where equipment_id=new.id) and status='pending';end if;return new;end;$$;
create trigger equipment_archive_maintenance after update of archived_at on public.customer_equipment for each row execute function private.sync_archived_equipment_maintenance();

create function public.list_customer_maintenance() returns jsonb language sql security definer stable set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'equipmentId',p.equipment_id,'equipmentName',e.nickname,'recommendation',p.recommendation,'dueAt',p.due_date,'status',case when exists(select 1 from public.complaints c where c.job_id=p.source_job_id and c.category in('quality','warranty') and c.status in('open','in_review','waiting_customer','waiting_professional')) then 'suppressed_by_case' else p.status end,'version',p.version,'sourceJobId',p.source_job_id,'history',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'jobId',r.job_id,'performedAt',r.created_at,'diagnosis',r.real_diagnosis,'workDone',r.work_done,'professionalId',r.professional_id) order by r.created_at desc),'[]'::jsonb) from public.equipment_service_records r where r.equipment_id=p.equipment_id)) order by p.due_date nulls last),'[]'::jsonb) from public.maintenance_plans p join public.customer_equipment e on e.id=p.equipment_id where p.customer_id=private.current_customer_id() and e.archived_at is null;
$$;

create function public.manage_maintenance_plan(p_plan_id uuid,p_action text,p_expected_version integer,p_due_date date,p_address_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_customer uuid:=private.current_customer_id();v_plan public.maintenance_plans%rowtype;v_equipment public.customer_equipment%rowtype;v_job public.jobs%rowtype;v_request public.service_requests%rowtype;v_new_request uuid;
begin
 if v_customer is null then raise exception using errcode='42501',message='customer_required';end if;select * into v_plan from public.maintenance_plans where id=p_plan_id and customer_id=v_customer for update;if not found then raise exception using errcode='P0002',message='plan_not_found';end if;
 if v_plan.version<>p_expected_version then raise exception using errcode='40001',message='plan_version_conflict';end if;
 select * into v_equipment from public.customer_equipment where id=v_plan.equipment_id and customer_id=v_customer and archived_at is null;if not found then raise exception using errcode='40001',message='equipment_unavailable';end if;
 if exists(select 1 from public.complaints c where c.job_id=v_plan.source_job_id and c.category in('quality','warranty') and c.status in('open','in_review','waiting_customer','waiting_professional')) then update public.maintenance_plans set status='suppressed_by_case',version=version+1,updated_at=clock_timestamp() where id=v_plan.id returning * into v_plan;return jsonb_build_object('id',v_plan.id,'status',v_plan.status,'dueAt',v_plan.due_date,'version',v_plan.version,'requestId',null,'reservationCreated',false,'paymentCreated',false);end if;
 if p_action='defer' then if p_due_date is null or p_due_date<=current_date then raise exception using errcode='22023',message='future_date_required';end if;update public.maintenance_plans set status='deferred',due_date=p_due_date,version=version+1,updated_at=clock_timestamp() where id=v_plan.id returning * into v_plan;update private.maintenance_reminders set status='cancelled' where plan_id=v_plan.id and status='pending';insert into private.maintenance_reminders(plan_id,scheduled_for,channel,dedupe_key) values(v_plan.id,p_due_date,'in_app','maintenance:'||v_plan.id||':'||p_due_date) on conflict(dedupe_key) do update set status=case when private.maintenance_reminders.status='cancelled' then 'pending' else private.maintenance_reminders.status end;
 elsif p_action='request_service' then if p_address_id is null or not exists(select 1 from public.customer_addresses a where a.id=p_address_id and a.customer_id=v_customer and a.archived_at is null) then raise exception using errcode='22023',message='current_address_required';end if;select * into v_job from public.jobs where id=v_plan.source_job_id;if not found then raise exception using errcode='40001',message='source_job_unavailable';end if;select * into v_request from public.service_requests where id=v_job.request_id;if not found then raise exception using errcode='40001',message='source_request_unavailable';end if;insert into public.service_requests(customer_id,category_id,issue_type_id,status,address_id,equipment_id,time_since,urgency_level,submitted_at) values(v_customer,v_request.category_id,v_request.issue_type_id,'draft',p_address_id,v_plan.equipment_id,null,null,null) returning id into v_new_request;update public.maintenance_plans set status='requested',requested_service_request_id=v_new_request,version=version+1,updated_at=clock_timestamp() where id=v_plan.id returning * into v_plan;
 else raise exception using errcode='22023',message='invalid_maintenance_action';end if;
 return jsonb_build_object('id',v_plan.id,'status',v_plan.status,'dueAt',v_plan.due_date,'version',v_plan.version,'requestId',v_plan.requested_service_request_id,'reservationCreated',false,'paymentCreated',false);
end;$$;

revoke all on function private.sync_maintenance_plan(),private.maintenance_due_date(public.maintenance_option,date),private.sync_maintenance_suppression(),private.sync_archived_equipment_maintenance() from public,anon,authenticated,service_role;
revoke all on function public.list_customer_maintenance(),public.manage_maintenance_plan(uuid,text,integer,date,uuid) from public,anon;
grant execute on function public.list_customer_maintenance(),public.manage_maintenance_plan(uuid,text,integer,date,uuid) to authenticated;
