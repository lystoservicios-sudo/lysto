-- Disposable T14 upgrade witness, after the general migration-upgrade fixture.
-- These are historical snapshots, deliberately lacking the new approval model.
insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at,request_id,accepted_at)
select ('90000000-0000-0000-0000-00000000001'||n)::uuid,'90000000-0000-0000-0000-000000000003',
  '{"street":"Synthetic","number":"1","city":"CABA","province":"CABA"}'::jsonb,
  '{"issue":"mantenimiento","timeSince":"days","urgency":"flexible","propertyType":"house","access":{}}'::jsonb,
  '{"total":130000,"calculatorSubtotal":100000,"safetyRate":0.3,"professionalAmount":106600,"platformFee":23400,"scope":"Legacy migration witness"}'::jsonb,
  current_date+1,'10:00 – 12:00',case when n=1 then 'accepted' else 'needs_review' end,now()+interval '30 minutes',
  case when n=1 then '90000000-0000-0000-0000-000000000005'::uuid else null end,case when n=1 then now() else null end
from generate_series(1,2) n;
