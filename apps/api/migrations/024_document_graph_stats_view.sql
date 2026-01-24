-- Recreate document_graph_stats view with security invoker and updated sources
create or replace view public.document_graph_stats
with (security_invoker = on) as
select
  (select count(*) from processed_documents) as total_documents,
  (select count(*) from document_relations) as total_relations,
  (select count(*) from document_clusters) as total_clusters,
  (select count(distinct document_relations.source_document_id) from document_relations) as documents_with_outgoing,
  (select count(distinct document_relations.target_document_id) from document_relations) as documents_with_incoming,
  (select avg(document_relations.strength) from document_relations) as avg_relation_strength;
