-- Migration: Add pdf_links column to scraped_content
-- Description: Dodanie kolumny pdf_links dla inteligentnego scrapera

-- Dodaj kolumnę pdf_links (tablica URLi do plików PDF)
ALTER TABLE scraped_content 
ADD COLUMN IF NOT EXISTS pdf_links TEXT[] DEFAULT '{}';

-- Dodaj unikalny constraint dla upsert (source_id, url)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'scraped_content_source_id_url_key'
  ) THEN
    ALTER TABLE scraped_content 
    ADD CONSTRAINT scraped_content_source_id_url_key UNIQUE (source_id, url);
  END IF;
END $$;

-- Indeks dla wyszukiwania po PDF linkach
CREATE INDEX IF NOT EXISTS idx_scraped_content_pdf_links 
ON scraped_content USING gin(pdf_links);

COMMENT ON COLUMN scraped_content.pdf_links IS 'Lista URLi do plików PDF znalezionych na stronie';
