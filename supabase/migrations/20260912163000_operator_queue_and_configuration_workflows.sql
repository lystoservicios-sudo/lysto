begin;

create table if not exists public.operator_queue_configuration (
  id boolean primary key default true check (id),
  priority_sla_minutes integer not null default 120 check (priority_sla_minutes between 15 and 10080),
  standard_sla_minutes integer not null default 1440 check (standard_sla_minutes between 30 and 43200),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.operator_queue_configuration(id) values(true) on conflict(id) do nothing;
alter table public.operator_queue_configuration enable row level security;
drop policy if exists operator_queue_configuration_read on public.operator_queue_configuration;
create policy operator_queue_configuration_read on public.operator_queue_configuration for select to authenticated using(private.has_admin_permission('operations'));
revoke all on public.operator_queue_configuration from public,anon,authenticated;
grant select(id,priority_sla_minutes,standard_sla_minutes,version,updated_at,updated_by) on public.operator_queue_configuration to authenticated;

create or replace function public.list_operator_queue(p_limit integer default 50,p_cursor_at timestamptz default null,p_cursor_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_rows jsonb;v_total integer;v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
begin
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='operations_permission_required';end if;
  with queue as (
    select r.id,'request'::text entity_type,r.created_at,r.status::text status,
      case when r.urgency_level='priority' then 'high' else 'normal' end priority,
      null::uuid assigned_to,
      case when r.status='pending_payment' then 'Esperar pago confirmado' when r.status in('matching','pending_assignment') then 'Asignar profesional' else 'Revisar solicitud' end next_action,
      r.created_at + make_interval(mins=>case when r.urgency_level='priority' then c.priority_sla_minutes else c.standard_sla_minutes end) due_at
    from public.service_requests r cross join public.operator_queue_configuration c
    where r.status not in('assigned','cancelled','expired')
    union all
    select j.id,'job',j.created_at,j.status::text,
      case when j.status in('disputed','warranty_claim','waiting_customer_approval') then 'high' else 'normal' end,
      j.professional_id,
      case when j.status='pending_assignment' then 'Asignar profesional' when j.status='completed_pending_customer_confirmation' then 'Esperar confirmación del cliente' when j.status in('disputed','warranty_claim') then 'Coordinar con calidad' else 'Seguir trabajo' end,
      j.created_at + make_interval(mins=>case when j.status in('disputed','warranty_claim','waiting_customer_approval') then c.priority_sla_minutes else c.standard_sla_minutes end)
    from public.jobs j cross join public.operator_queue_configuration c
    where j.status not in('completed','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin')
    union all
    select c.id,'support_case',c.created_at,c.status,c.severity,coalesce(c.assigned_to,c.opened_by),
      case when c.assigned_to is null then 'Asignar responsable' when c.status='waiting_customer' then 'Esperar respuesta del cliente' when c.status='waiting_professional' then 'Esperar respuesta profesional' else 'Resolver caso' end,
      c.due_at
    from public.complaints c where c.status not in('resolved','rejected')
  ), visible as (
    select * from queue where p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id) order by created_at desc,id desc limit v_limit+1
  )
  select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc,v.id desc),'[]'::jsonb) into v_rows from visible v;
  select count(*) into v_total from (
    select id from public.service_requests where status not in('assigned','cancelled','expired') union all
    select id from public.jobs where status not in('completed','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin') union all
    select id from public.complaints where status not in('resolved','rejected')
  ) x;
  return jsonb_build_object('items',v_rows,'total',v_total);
end $$;
revoke all on function public.list_operator_queue(integer,timestamptz,uuid) from public,anon;
grant execute on function public.list_operator_queue(integer,timestamptz,uuid) to authenticated;

commit;
