-- Seed inicial de Lysto para aire acondicionado.
insert into public.service_categories (slug, name, description, active)
values ('aire_acondicionado', 'Aire acondicionado', 'Reparación, instalación y mantenimiento de equipos de aire acondicionado.', true)
on conflict (slug) do update set name = excluded.name, description = excluded.description, active = excluded.active;

with category as (select id from public.service_categories where slug = 'aire_acondicionado')
insert into public.service_issue_types (category_id, slug, name, description, icon, sort_order)
select category.id, issue.slug, issue.name, issue.description, issue.icon, issue.sort_order
from category, (values
  ('no_enfria','No enfría','El equipo funciona, pero no enfría como antes.','🧊',10),
  ('pierde_agua','Pierde agua','Gotea o acumula agua dentro del ambiente.','💧',20),
  ('hace_ruido','Hace ruido','Hace vibraciones, golpes o sonidos anormales.','🔊',30),
  ('no_enciende','No enciende','No prende o se apaga inmediatamente.','⚡',40),
  ('no_funciona_calor','No funciona calor','No calienta o no invierte correctamente el ciclo.','🔥',50),
  ('instalacion','Instalación','Instalación nueva o reinstalación de equipo.','🛠️',60),
  ('mantenimiento','Mantenimiento','Limpieza, revisión preventiva o puesta a punto.','🧹',70)
) as issue(slug, name, description, icon, sort_order)
on conflict (category_id, slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order, active = true;

with category as (select id from public.service_categories where slug = 'aire_acondicionado')
insert into public.service_questions (category_id, code, label, input_type, required, sort_order)
select category.id, q.code, q.label, q.input_type, q.required, q.sort_order
from category, (values
  ('time_since','¿Desde cuándo sucede?','single_choice',true,10),
  ('media','Fotos o video del equipo','media',false,20),
  ('access_details','Detalles de acceso','multi_choice',false,30)
) as q(code, label, input_type, required, sort_order)
on conflict (category_id, code) do update set label = excluded.label, input_type = excluded.input_type, required = excluded.required, sort_order = excluded.sort_order, active = true;

with q as (select id from public.service_questions where code = 'time_since')
insert into public.service_question_options (question_id, value, label, sort_order)
select q.id, v.value, v.label, v.sort_order
from q, (values ('today','Hoy',10),('days','Hace días',20),('weeks','Hace semanas',30),('months','Hace meses',40)) as v(value, label, sort_order)
on conflict (question_id, value) do update set label = excluded.label, sort_order = excluded.sort_order;

with q as (select id from public.service_questions where code = 'access_details')
insert into public.service_question_options (question_id, value, label, sort_order)
select q.id, v.value, v.label, v.sort_order
from q, (values ('has_elevator','Ascensor',10),('has_parking','Estacionamiento',20),('stairs_required','Escalera',30),('outdoor_unit_at_height','Unidad exterior en altura',40),('outdoor_unit_on_balcony','Unidad exterior en balcón',50),('difficult_access','Acceso complicado',60)) as v(value, label, sort_order)
on conflict (question_id, value) do update set label = excluded.label, sort_order = excluded.sort_order;

with category as (select id from public.service_categories where slug = 'aire_acondicionado'), issues as (select id, slug from public.service_issue_types)
insert into public.pricing_rules (category_id, issue_type_id, zone_slug, base_price, issue_adjustment, priority_multiplier, platform_fee_rate)
select category.id, issues.id, 'caba', 35000,
  case issues.slug when 'no_enciende' then 5000 when 'no_funciona_calor' then 5000 when 'instalacion' then 20000 else 0 end,
  1.25,
  0.18
from category, issues
where issues.slug in ('no_enfria','pierde_agua','hace_ruido','no_enciende','no_funciona_calor','instalacion','mantenimiento')
on conflict (category_id, issue_type_id, zone_slug) do update set base_price = excluded.base_price, issue_adjustment = excluded.issue_adjustment, priority_multiplier = excluded.priority_multiplier, platform_fee_rate = excluded.platform_fee_rate, active = true;

insert into public.platform_settings (key, value, description)
values
  ('maintenance_options', '["none","filters_30_days","filters_60_days","filters_90_days","deep_cleaning_6_months","deep_cleaning_annual","gas_review_30_days","outdoor_unit_review","electrical_review","pending_part_replacement","second_visit_recommended"]'::jsonb, 'Opciones cerradas de mantenimiento recomendadas.'),
  ('time_windows', '["08:00 – 10:00","10:00 – 12:00","14:00 – 16:00","16:00 – 18:00","18:00 – 20:00"]'::jsonb, 'Franjas horarias iniciales.'),
  ('platform_fee_rate', '0.18'::jsonb, 'Comisión base de Lysto para MVP.')
on conflict (key) do update set value = excluded.value, description = excluded.description, updated_at = now();

-- Extensiones operativas
insert into public.service_zones (name, province, city, priority_weight) values
  ('CABA Norte', 'Buenos Aires', 'CABA', 20),
  ('CABA Centro', 'Buenos Aires', 'CABA', 30),
  ('CABA Sur', 'Buenos Aires', 'CABA', 10),
  ('AMBA Primer Cordón', 'Buenos Aires', 'AMBA', 5)
on conflict (name) do update set priority_weight = excluded.priority_weight;

insert into public.professional_training_modules (title, description, category_slug, required_for_approval) values
  ('Protocolo Lysto en domicilio', 'Presentación, cuidado del hogar, fotos obligatorias y cierre del servicio.', 'aire_acondicionado', true),
  ('Checklist técnico aire acondicionado', 'Revisión de presión, filtros, unidad exterior, consumo eléctrico y drenaje.', 'aire_acondicionado', true),
  ('Uso del portal profesional', 'Aceptar trabajos, cambiar estados, cargar reportes, equipos y comprobantes.', 'aire_acondicionado', true),
  ('Calidad y garantías', 'Cómo registrar garantías, pendientes, segunda visita y casos de calidad.', 'aire_acondicionado', true)
on conflict do nothing;

insert into public.platform_settings (key, value) values
  ('notifications.email_enabled', 'true'::jsonb),
  ('notifications.whatsapp_manual_mode', 'true'::jsonb),
  ('quality.low_rating_threshold', '2'::jsonb),
  ('quality.default_resolved_warranty_days', '30'::jsonb),
  ('operations.require_after_photo_to_close_job', 'true'::jsonb)
on conflict (key) do update set value = excluded.value;
