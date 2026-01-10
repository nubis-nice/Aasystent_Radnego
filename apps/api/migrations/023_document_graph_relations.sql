-- ============================================
-- Migracja: Graf powiązań dokumentów
-- Data: 2026-01-10
-- Opis: Implementacja grafu relacji między dokumentami (alternatywa dla Apache AGE)
-- ============================================

-- 1. Typy relacji między dokumentami
CREATE TYPE document_relation_type AS ENUM (
  'references',      -- Dokument A referencjonuje dokument B (np. "patrz druk nr 109")
  'amends',          -- Dokument A zmienia dokument B (nowelizacja)
  'supersedes',      -- Dokument A zastępuje dokument B
  'implements',      -- Dokument A implementuje dokument B (np. uchwała wykonawcza)
  'contains',        -- Dokument A zawiera dokument B (np. sesja zawiera protokół)
  'attachment',      -- Dokument A jest załącznikiem do dokumentu B
  'related',         -- Ogólna relacja powiązania
  'responds_to',     -- Dokument A jest odpowiedzią na dokument B
  'derived_from'     -- Dokument A pochodzi z dokumentu B
);

-- 2. Tabela krawędzi grafu (relacje między dokumentami)
CREATE TABLE IF NOT EXISTS document_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Węzły źródłowy i docelowy (używamy processed_documents zamiast documents)
  source_document_id UUID NOT NULL REFERENCES processed_documents(id) ON DELETE CASCADE,
  target_document_id UUID NOT NULL REFERENCES processed_documents(id) ON DELETE CASCADE,
  
  -- Typ i siła relacji
  relation_type document_relation_type NOT NULL DEFAULT 'related',
  strength DECIMAL(3,2) DEFAULT 1.0 CHECK (strength >= 0 AND strength <= 1),
  
  -- Kontekst relacji
  context TEXT,                      -- Fragment tekstu gdzie znaleziono referencję
  reference_text VARCHAR(500),       -- Oryginalny tekst referencji (np. "druk nr 109")
  detected_automatically BOOLEAN DEFAULT true,
  verified_by_user BOOLEAN DEFAULT false,
  
  -- Metadane
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unikalna relacja między parą dokumentów danego typu
  UNIQUE(source_document_id, target_document_id, relation_type)
);

-- 3. Indeksy dla szybkiego wyszukiwania
CREATE INDEX IF NOT EXISTS idx_doc_relations_source ON document_relations(source_document_id);
CREATE INDEX IF NOT EXISTS idx_doc_relations_target ON document_relations(target_document_id);
CREATE INDEX IF NOT EXISTS idx_doc_relations_type ON document_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_doc_relations_strength ON document_relations(strength DESC);

-- Indeks dla wyszukiwania dwukierunkowego (znajdź wszystkie powiązane dokumenty)
CREATE INDEX IF NOT EXISTS idx_doc_relations_bidirectional 
  ON document_relations(source_document_id, target_document_id);

-- 4. Tabela klastrów dokumentów (grupy powiązanych dokumentów)
CREATE TABLE IF NOT EXISTS document_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(200) NOT NULL,
  description TEXT,
  cluster_type VARCHAR(50) DEFAULT 'auto',  -- auto, manual, session, committee
  
  -- Główny dokument klastra (root)
  root_document_id UUID REFERENCES processed_documents(id) ON DELETE SET NULL,
  
  -- Statystyki
  document_count INTEGER DEFAULT 0,
  total_strength DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Przynależność dokumentów do klastrów (wiele-do-wielu)
CREATE TABLE IF NOT EXISTS document_cluster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES document_clusters(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES processed_documents(id) ON DELETE CASCADE,
  
  -- Pozycja w klastrze (dla hierarchii)
  depth INTEGER DEFAULT 0,           -- 0 = root, 1 = bezpośredni potomek, etc.
  parent_document_id UUID REFERENCES processed_documents(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cluster_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON document_cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_document ON document_cluster_members(document_id);

-- 6. Funkcja: Znajdź wszystkie powiązane dokumenty (BFS traversal)
CREATE OR REPLACE FUNCTION get_related_documents(
  p_document_id UUID,
  p_max_depth INTEGER DEFAULT 3,
  p_min_strength DECIMAL DEFAULT 0.3
)
RETURNS TABLE (
  document_id UUID,
  depth INTEGER,
  path UUID[],
  total_strength DECIMAL,
  relation_types document_relation_type[]
) AS $$
WITH RECURSIVE document_graph AS (
  -- Punkt startowy
  SELECT 
    dr.target_document_id as document_id,
    1 as depth,
    ARRAY[p_document_id, dr.target_document_id] as path,
    dr.strength::DECIMAL as total_strength,
    ARRAY[dr.relation_type] as relation_types
  FROM document_relations dr
  WHERE dr.source_document_id = p_document_id
    AND dr.strength >= p_min_strength
  
  UNION
  
  -- Rekurencyjne rozwinięcie
  SELECT 
    dr.target_document_id,
    dg.depth + 1,
    dg.path || dr.target_document_id,
    (dg.total_strength * dr.strength)::DECIMAL,
    dg.relation_types || dr.relation_type
  FROM document_graph dg
  JOIN document_relations dr ON dr.source_document_id = dg.document_id
  WHERE dg.depth < p_max_depth
    AND NOT dr.target_document_id = ANY(dg.path)  -- Unikaj cykli
    AND dr.strength >= p_min_strength
)
SELECT DISTINCT ON (document_id)
  document_id,
  depth,
  path,
  total_strength,
  relation_types
FROM document_graph
ORDER BY document_id, total_strength DESC;
$$ LANGUAGE SQL STABLE;

-- 7. Funkcja: Znajdź najkrótszą ścieżkę między dokumentami
CREATE OR REPLACE FUNCTION find_document_path(
  p_source_id UUID,
  p_target_id UUID,
  p_max_depth INTEGER DEFAULT 5
)
RETURNS TABLE (
  path UUID[],
  depth INTEGER,
  relation_types document_relation_type[],
  total_strength DECIMAL
) AS $$
WITH RECURSIVE path_search AS (
  -- Punkt startowy
  SELECT 
    ARRAY[p_source_id, dr.target_document_id] as path,
    1 as depth,
    ARRAY[dr.relation_type] as relation_types,
    dr.strength::DECIMAL as total_strength,
    dr.target_document_id = p_target_id as found
  FROM document_relations dr
  WHERE dr.source_document_id = p_source_id
  
  UNION ALL
  
  -- Rekurencyjne rozwinięcie
  SELECT 
    ps.path || dr.target_document_id,
    ps.depth + 1,
    ps.relation_types || dr.relation_type,
    (ps.total_strength * dr.strength)::DECIMAL,
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
$$ LANGUAGE SQL STABLE;

-- 8. Funkcja: Automatyczne wykrywanie relacji z treści dokumentu
CREATE OR REPLACE FUNCTION detect_document_references(p_document_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_content TEXT;
  v_title TEXT;
  v_count INTEGER := 0;
  v_ref RECORD;
BEGIN
  -- Pobierz treść dokumentu
  SELECT content, title INTO v_content, v_title
  FROM processed_documents WHERE id = p_document_id;
  
  IF v_content IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Szukaj referencji do druków: "druk nr 109", "(druk 109)"
  FOR v_ref IN
    SELECT DISTINCT 
      d.id as target_id,
      'references'::document_relation_type as rel_type,
      match[1] as ref_text
    FROM processed_documents d,
    LATERAL (
      SELECT regexp_matches(v_content, 'druk(?:u|iem|owi)?\s*n?r?\.?\s*(\d+)', 'gi') as match
    ) m
    WHERE d.title ~* ('druk.*' || m.match[1])
      AND d.id != p_document_id
  LOOP
    INSERT INTO document_relations (source_document_id, target_document_id, relation_type, reference_text)
    VALUES (p_document_id, v_ref.target_id, v_ref.rel_type, v_ref.ref_text)
    ON CONFLICT (source_document_id, target_document_id, relation_type) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  
  -- Szukaj referencji do uchwał: "uchwała XV/123/2024"
  FOR v_ref IN
    SELECT DISTINCT 
      d.id as target_id,
      'references'::document_relation_type as rel_type,
      match[1] as ref_text
    FROM processed_documents d,
    LATERAL (
      SELECT regexp_matches(v_content, 'uchwa[łl][aęy]\s+([IVXLCDM]+[\/\-]\d+[\/\-]\d+)', 'gi') as match
    ) m
    WHERE d.title ~* m.match[1]
      AND d.id != p_document_id
  LOOP
    INSERT INTO document_relations (source_document_id, target_document_id, relation_type, reference_text)
    VALUES (p_document_id, v_ref.target_id, v_ref.rel_type, v_ref.ref_text)
    ON CONFLICT (source_document_id, target_document_id, relation_type) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger: Automatycznie wykrywaj relacje przy dodaniu/aktualizacji dokumentu
CREATE OR REPLACE FUNCTION trigger_detect_references()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM detect_document_references(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS detect_references_on_document ON processed_documents;
CREATE TRIGGER detect_references_on_document
  AFTER INSERT OR UPDATE OF content ON processed_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_detect_references();

-- 10. RLS Policies
ALTER TABLE document_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_cluster_members ENABLE ROW LEVEL SECURITY;

-- Wszyscy zalogowani użytkownicy mogą czytać relacje
CREATE POLICY "Users can read document relations"
  ON document_relations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can read document clusters"
  ON document_clusters FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can read cluster members"
  ON document_cluster_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 11. Widok: Statystyki grafu dokumentów
CREATE OR REPLACE VIEW document_graph_stats AS
SELECT 
  (SELECT COUNT(*) FROM processed_documents) as total_documents,
  (SELECT COUNT(*) FROM document_relations) as total_relations,
  (SELECT COUNT(*) FROM document_clusters) as total_clusters,
  (SELECT COUNT(DISTINCT source_document_id) FROM document_relations) as documents_with_outgoing,
  (SELECT COUNT(DISTINCT target_document_id) FROM document_relations) as documents_with_incoming,
  (SELECT AVG(strength) FROM document_relations) as avg_relation_strength;

-- 12. Inicjalizacja: Wykryj relacje dla istniejących dokumentów
DO $$
DECLARE
  v_doc RECORD;
  v_total INTEGER := 0;
BEGIN
  FOR v_doc IN SELECT id FROM processed_documents LOOP
    v_total := v_total + detect_document_references(v_doc.id);
  END LOOP;
  RAISE NOTICE 'Detected % relations in existing documents', v_total;
END $$;

COMMENT ON TABLE document_relations IS 'Graf powiązań między dokumentami - krawędzie';
COMMENT ON TABLE document_clusters IS 'Klastry powiązanych dokumentów';
COMMENT ON FUNCTION get_related_documents IS 'Znajdź wszystkie dokumenty powiązane z danym dokumentem (BFS)';
COMMENT ON FUNCTION find_document_path IS 'Znajdź najkrótszą ścieżkę między dwoma dokumentami';
