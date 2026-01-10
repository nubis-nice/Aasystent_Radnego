-- Migration: Data Sources System
-- Description: Tabele dla systemu pobierania danych z zewnętrznych źródeł (scraping)

-- Źródła danych
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('municipality', 'bip', 'legal', 'councilor', 'statistics', 'national_park', 'hospital', 'school', 'cultural', 'environmental', 'transport', 'emergency', 'custom')),
  url TEXT NOT NULL,
  scraping_enabled BOOLEAN DEFAULT true,
  scraping_frequency TEXT DEFAULT 'daily' CHECK (scraping_frequency IN ('hourly', 'daily', 'weekly', 'monthly', 'manual')),
  last_scraped_at TIMESTAMPTZ,
  next_scrape_at TIMESTAMPTZ,
  scraping_config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_data_sources_user_id ON data_sources(user_id);
CREATE INDEX idx_data_sources_type ON data_sources(type);
CREATE INDEX idx_data_sources_next_scrape ON data_sources(next_scrape_at) WHERE scraping_enabled = true;

-- Pobrane treści (surowe dane)
CREATE TABLE IF NOT EXISTS scraped_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  content_type TEXT DEFAULT 'html' CHECK (content_type IN ('html', 'pdf', 'json', 'xml', 'text')),
  raw_content TEXT,
  content_hash TEXT, -- SHA256 hash do wykrywania zmian
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_scraped_content_source_id ON scraped_content(source_id);
CREATE INDEX idx_scraped_content_hash ON scraped_content(content_hash);
CREATE INDEX idx_scraped_content_scraped_at ON scraped_content(scraped_at DESC);

-- Przetworzone dokumenty (z embeddings)
CREATE TABLE IF NOT EXISTS processed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_content_id UUID REFERENCES scraped_content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'resolution', 'protocol', 'news', 'legal_act', 'announcement', 'article'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  keywords TEXT[],
  publish_date TIMESTAMPTZ,
  source_url TEXT,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_processed_documents_user_id ON processed_documents(user_id);
CREATE INDEX idx_processed_documents_type ON processed_documents(document_type);
CREATE INDEX idx_processed_documents_publish_date ON processed_documents(publish_date DESC);
CREATE INDEX idx_processed_documents_embedding ON processed_documents USING ivfflat (embedding vector_cosine_ops);

-- Logi scrapingu
CREATE TABLE IF NOT EXISTS scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial', 'skipped')),
  items_scraped INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scraping_logs_source_id ON scraping_logs(source_id);
CREATE INDEX idx_scraping_logs_created_at ON scraping_logs(created_at DESC);
CREATE INDEX idx_scraping_logs_status ON scraping_logs(status);

-- Funkcja do aktualizowania next_scrape_at
CREATE OR REPLACE FUNCTION calculate_next_scrape(frequency TEXT, base_time TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN CASE frequency
    WHEN 'hourly' THEN base_time + INTERVAL '1 hour'
    WHEN 'daily' THEN base_time + INTERVAL '1 day'
    WHEN 'weekly' THEN base_time + INTERVAL '7 days'
    WHEN 'monthly' THEN base_time + INTERVAL '30 days'
    ELSE NULL -- manual
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger do automatycznego ustawiania next_scrape_at
CREATE OR REPLACE FUNCTION update_next_scrape_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scraping_enabled THEN
    NEW.next_scrape_at := calculate_next_scrape(NEW.scraping_frequency, COALESCE(NEW.last_scraped_at, NOW()));
  ELSE
    NEW.next_scrape_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_next_scrape_time
BEFORE INSERT OR UPDATE OF scraping_frequency, scraping_enabled, last_scraped_at ON data_sources
FOR EACH ROW
EXECUTE FUNCTION update_next_scrape_time();

-- Funkcja do wyszukiwania semantycznego w przetworzonych dokumentach
CREATE OR REPLACE FUNCTION search_processed_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id uuid,
  filter_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_type text,
  title text,
  content text,
  summary text,
  source_url text,
  publish_date timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    processed_documents.id,
    processed_documents.document_type,
    processed_documents.title,
    processed_documents.content,
    processed_documents.summary,
    processed_documents.source_url,
    processed_documents.publish_date,
    1 - (processed_documents.embedding <=> query_embedding) as similarity
  FROM processed_documents
  WHERE processed_documents.user_id = filter_user_id
    AND (filter_types IS NULL OR processed_documents.document_type = ANY(filter_types))
    AND 1 - (processed_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY processed_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RLS Policies

-- Data Sources
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data sources"
  ON data_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own data sources"
  ON data_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data sources"
  ON data_sources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data sources"
  ON data_sources FOR DELETE
  USING (auth.uid() = user_id);

-- Scraped Content
ALTER TABLE scraped_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scraped content from own sources"
  ON scraped_content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM data_sources
      WHERE data_sources.id = scraped_content.source_id
      AND data_sources.user_id = auth.uid()
    )
  );

-- Processed Documents
ALTER TABLE processed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processed documents"
  ON processed_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own processed documents"
  ON processed_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processed documents"
  ON processed_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own processed documents"
  ON processed_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Scraping Logs
ALTER TABLE scraping_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs from own sources"
  ON scraping_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM data_sources
      WHERE data_sources.id = scraping_logs.source_id
      AND data_sources.user_id = auth.uid()
    )
  );

-- Domyślne źródła danych dla nowych użytkowników
CREATE OR REPLACE FUNCTION create_default_data_sources()
RETURNS TRIGGER AS $$
BEGIN
  -- Strona gminy Drawno
  INSERT INTO data_sources (user_id, name, type, url, scraping_frequency, scraping_config)
  VALUES (
    NEW.id,
    'Gmina Drawno - Aktualności',
    'municipality',
    'https://www.drawno.pl',
    'daily',
    '{"selectors": {"news_list": ".news-item", "title": "h2", "content": ".content", "date": ".date"}}'::jsonb
  );

  -- BIP Gminy Drawno
  INSERT INTO data_sources (user_id, name, type, url, scraping_frequency, scraping_config)
  VALUES (
    NEW.id,
    'BIP Drawno - Uchwały',
    'bip',
    'https://bip.drawno.pl',
    'daily',
    '{"selectors": {"document_list": ".document", "title": ".title", "pdf_link": "a.pdf"}}'::jsonb
  );

  -- ISAP - Portal prawny
  INSERT INTO data_sources (user_id, name, type, url, scraping_frequency, scraping_enabled, scraping_config)
  VALUES (
    NEW.id,
    'ISAP - Akty prawne samorządowe',
    'legal',
    'https://isap.sejm.gov.pl',
    'weekly',
    false, -- domyślnie wyłączone
    '{"search_params": {"category": "samorzad"}}'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger tworzący domyślne źródła dla nowych użytkowników
CREATE TRIGGER create_user_default_sources
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_default_data_sources();

COMMENT ON TABLE data_sources IS 'Konfiguracja źródeł danych do scrapingu';
COMMENT ON TABLE scraped_content IS 'Surowe dane pobrane ze źródeł';
COMMENT ON TABLE processed_documents IS 'Przetworzone dokumenty z embeddings';
COMMENT ON TABLE scraping_logs IS 'Logi operacji scrapingu';
