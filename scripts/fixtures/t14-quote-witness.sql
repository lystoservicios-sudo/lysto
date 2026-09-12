select jsonb_agg(to_jsonb(q)-array['revision','version','root_quote_id','previous_quote_id','created_by','revision_reason','manual_route_reason','policy_id','policy_snapshot','acceptance_result','upload_intent_ids'] order by q.id)
from public.service_quotes q where q.customer_id='90000000-0000-0000-0000-000000000003';
