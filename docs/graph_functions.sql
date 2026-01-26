-- Funkcje RPC dla grafu dokumentów
-- Data: 2026-01-26

-- Funkcja: find_document_path
CREATE OR REPLACE FUNCTION public.find_document_path(p_source_id uuid, p_target_id uuid, p_max_depth integer DEFAULT 5) 
RETURNS TABLE(path uuid[], depth integer, relation_types text[], total_strength numeric)
LANGUAGE sql STABLE
AS $$
WITH RECURSIVE path_search AS (
  -- Punkt startowy
  SELECT 
    ARRAY[p_source_id, dr.target_document_id] as path,
    1 as depth,
    ARRAY[dr.relation_type::text] as relation_types,
    COALESCE(dr.strength, 1.0)::DECIMAL as total_strength,
    dr.target_document_id = p_target_id as found
  FROM document_relations dr
  WHERE dr.source_document_id = p_source_id
  
  UNION ALL
  
  -- Rekurencyjne rozwinięcie
  SELECT 
    ps.path || dr.target_document_id,
    ps.depth + 1,
    ps.relation_types || dr.relation_type::text,
    (ps.total_strength * COALESCE(dr.strength, 1.0))::DECIMAL,
    dr.target_document_id = p_target_id
  FROM path_search ps
  JOIN document_relations dr ON dr.source_document_id = ps.path[array_length(ps.path, 1)]
  WHERE NOT ps.found
    AND ps.depth < p_max_depth
    AND NOT dr.target_document_id = ANY(ps.path)
)
SELECT path, depth, relation_types, total_strength
FROM path_search
WHERE found
ORDER BY depth ASC, total_strength DESC
LIMIT 5;
$$;

COMMENT ON FUNCTION public.find_document_path(uuid, uuid, integer) IS 'Znajdź najkrótszą ścieżkę między dwoma dokumentami';

-- Funkcja: get_related_documents
CREATE OR REPLACE FUNCTION public.get_related_documents(p_document_id uuid, p_max_depth integer DEFAULT 3, p_min_strength numeric DEFAULT 0.3) 
RETURNS TABLE(document_id uuid, depth integer, path uuid[], total_strength numeric, relation_types text[])
LANGUAGE sql STABLE
AS $$
WITH RECURSIVE document_graph AS (
  -- Punkt startowy
  SELECT 
    dr.target_document_id as document_id,
    1 as depth,
    ARRAY[p_document_id, dr.target_document_id] as path,
    COALESCE(dr.strength, 1.0)::DECIMAL as total_strength,
    ARRAY[dr.relation_type::text] as relation_types
  FROM document_relations dr
  WHERE dr.source_document_id = p_document_id
    AND COALESCE(dr.strength, 1.0) >= p_min_strength
  
  UNION
  
  -- Rekurencyjne rozwinięcie
  SELECT 
    dr.target_document_id,
    dg.depth + 1,
    dg.path || dr.target_document_id,
    (dg.total_strength * COALESCE(dr.strength, 1.0))::DECIMAL,
    dg.relation_types || dr.relation_type::text
  FROM document_graph dg
  JOIN document_relations dr ON dr.source_document_id = dg.document_id
  WHERE dg.depth < p_max_depth
    AND NOT dr.target_document_id = ANY(dg.path)
    AND COALESCE(dr.strength, 1.0) >= p_min_strength
)
SELECT DISTINCT ON (document_id)
  document_id,
  depth,
  path,
  total_strength,
  relation_types
FROM document_graph
ORDER BY document_id, total_strength DESC;
$$;

COMMENT ON FUNCTION public.get_related_documents(uuid, integer, numeric) IS 'Znajdź wszystkie dokumenty powiązane z danym dokumentem (BFS)';

-- Uprawnienia
GRANT ALL ON FUNCTION public.find_document_path(uuid, uuid, integer) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_related_documents(uuid, integer, numeric) TO anon, authenticated, service_role;
