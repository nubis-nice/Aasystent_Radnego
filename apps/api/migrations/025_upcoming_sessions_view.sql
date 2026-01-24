-- Recreate upcoming_sessions view with security invoker
create or replace view public.upcoming_sessions
with (security_invoker = on) as
select
  id,
  user_id,
  title,
  document_type,
  session_number,
  normalized_publish_date as event_date,
  source_url,
  'session'::text as event_type
from processed_documents
where document_type = any (array['session_agenda'::text, 'session_protocol'::text, 'committee_meeting'::text])
  and normalized_publish_date >= current_date
order by normalized_publish_date;
