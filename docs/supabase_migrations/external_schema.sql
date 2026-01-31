


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."document_relation_type" AS ENUM (
    'references',
    'amends',
    'supersedes',
    'implements',
    'contains',
    'attachment',
    'related',
    'responds_to',
    'derived_from'
);


ALTER TYPE "public"."document_relation_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_ceidg_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
    api_config, category, tags, priority, jurisdiction,
    enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
  )
  VALUES (
    NEW.id,
    'CEIDG - Ewidencja Działalności Gospodarczej',
    'statistics',
    'https://dane.biznes.gov.pl',
    'api',
    'daily',
    true,
    jsonb_build_object(
      'endpoints', jsonb_build_object(
        'search', '/api/ceidg/v2/firmy',
        'byNip', '/api/ceidg/v2/firmy?nip=',
        'byRegon', '/api/ceidg/v2/firmy?regon='
      ),
      'requiresApiKey', true,
      'rateLimit', jsonb_build_object('maxRequests', 100, 'window', '1min'),
      'cache', jsonb_build_object('enabled', true, 'ttl', 3600)
    ),
    'statistical',
    ARRAY['ceidg', 'jednoosobowa działalność', 'przedsiębiorcy', 'firmy', 'NIP', 'REGON'],
    'normal',
    'Rzeczpospolita Polska',
    false, false, true, false,
    jsonb_build_object(
      'description', 'Centralna Ewidencja i Informacja o Działalności Gospodarczej',
      'provider', 'Ministerstwo Rozwoju i Technologii',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'ceidg_registry'
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_ceidg_source"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_eu_funds_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- EU Funds - Portal Funduszy Europejskich
  INSERT INTO data_sources (
    user_id, 
    name, 
    type, 
    url, 
    fetch_method,
    scraping_frequency, 
    scraping_enabled, 
    api_config,
    category, 
    tags, 
    priority, 
    jurisdiction, 
    enable_embeddings,
    enable_classification,
    enable_keyword_extraction,
    enable_summarization,
    metadata
  )
  VALUES (
    NEW.id,
    'Fundusze Europejskie - Portal i Mapa Dotacji',
    'funding',
    'https://www.funduszeeuropejskie.gov.pl',
    'api',
    'daily',
    true,
    jsonb_build_object(
      'sources', jsonb_build_array(
        jsonb_build_object(
          'name', 'Portal Funduszy Europejskich',
          'url', 'https://www.funduszeeuropejskie.gov.pl',
          'type', 'competitions'
        ),
        jsonb_build_object(
          'name', 'Mapa Dotacji UE',
          'url', 'https://mapadotacji.gov.pl',
          'type', 'projects'
        ),
        jsonb_build_object(
          'name', 'Baza Konkurencyjności',
          'url', 'https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl',
          'type', 'offers'
        )
      ),
      'programs', jsonb_build_array(
        'FENG', 'FERS', 'FEnIKS', 'FERC', 'Interreg', 'KPO'
      ),
      'rateLimit', jsonb_build_object(
        'maxRequests', 50,
        'window', '1min'
      )
    ),
    'statistical',
    ARRAY['dotacje', 'fundusze_europejskie', 'nabory', 'konkursy', 'dofinansowanie', 'ue', 'projekty', 'EU_Funds'],
    'high',
    'Unia Europejska',
    true,
    true,
    true,
    true,
    jsonb_build_object(
      'description', 'Źródło informacji o funduszach europejskich, aktualnych naborach i projektach',
      'dataTypes', ARRAY['konkursy', 'nabory', 'projekty', 'dotacje', 'zapytania_ofertowe'],
      'coverage', 'Perspektywa 2021-2027 i archiwalne',
      'updateFrequency', 'Codziennie',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'eu_funds',
      'useCases', ARRAY[
        'Wyszukiwanie aktualnych naborów',
        'Analiza projektów w regionie',
        'Identyfikacja możliwości dofinansowania',
        'Monitoring terminów konkursów'
      ]
    )
  )
  ON CONFLICT DO NOTHING;
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_eu_funds_source"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_eu_funds_source"() IS 'Funkcja dodająca źródło Funduszy Europejskich dla użytkownika';



CREATE OR REPLACE FUNCTION "public"."add_gdos_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
    api_config, category, tags, priority, jurisdiction,
    enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
  )
  VALUES (
    NEW.id,
    'GDOŚ - Dane Środowiskowe',
    'statistics',
    'https://sdi.gdos.gov.pl',
    'api',
    'weekly',
    true,
    jsonb_build_object(
      'services', jsonb_build_object(
        'wfs', 'https://sdi.gdos.gov.pl/wfs',
        'natura2000', 'https://natura2000.gdos.gov.pl'
      ),
      'layers', jsonb_build_array(
        'FormaOchronyPrzyrody',
        'Natura2000',
        'ParkNarodowy',
        'RezerwatPrzyrody',
        'ParkKrajobrazowy'
      ),
      'rateLimit', jsonb_build_object('maxRequests', 30, 'window', '1min'),
      'cache', jsonb_build_object('enabled', true, 'ttl', 86400)
    ),
    'statistical',
    ARRAY['gdoś', 'natura 2000', 'obszary chronione', 'rezerwaty', 'parki narodowe', 'środowisko'],
    'normal',
    'Rzeczpospolita Polska',
    false, false, true, false,
    jsonb_build_object(
      'description', 'Generalna Dyrekcja Ochrony Środowiska - dane o obszarach chronionych',
      'provider', 'Generalna Dyrekcja Ochrony Środowiska',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'gdos_environmental',
      'useCases', ARRAY[
        'Sprawdzanie ograniczeń środowiskowych dla lokalizacji',
        'Weryfikacja obszarów Natura 2000',
        'Analiza oddziaływania na środowisko'
      ]
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_gdos_source"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_geoportal_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Geoportal - Dane przestrzenne
  INSERT INTO data_sources (
    user_id, 
    name, 
    type, 
    url, 
    fetch_method,
    scraping_frequency, 
    scraping_enabled, 
    api_config,
    category, 
    tags, 
    priority, 
    jurisdiction, 
    enable_embeddings,
    enable_classification,
    enable_keyword_extraction,
    enable_summarization,
    metadata
  )
  VALUES (
    NEW.id,
    'Geoportal - Dane Przestrzenne',
    'spatial',
    'https://geoportal.gov.pl',
    'api',
    'weekly',
    true,
    jsonb_build_object(
      'services', jsonb_build_object(
        'ULDK', 'https://uldk.gugik.gov.pl',
        'PRG', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries',
        'EMUiA', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/EMUiA/WFS/Addresses',
        'BDOT', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WFS/Topographic'
      ),
      'capabilities', jsonb_build_array(
        'parcel_search',
        'address_geocoding',
        'administrative_boundaries',
        'spatial_plans',
        'orthophoto'
      ),
      'rateLimit', jsonb_build_object(
        'maxRequests', 100,
        'window', '1min'
      ),
      'cache', jsonb_build_object(
        'enabled', true,
        'ttl', 3600
      )
    ),
    'statistical',
    ARRAY['geoportal', 'działki', 'MPZP', 'mapy', 'nieruchomości', 'granice', 'gminy', 'WMS', 'WFS'],
    'normal',
    'Rzeczpospolita Polska',
    false,
    false,
    true,
    false,
    jsonb_build_object(
      'description', 'Krajowy portal danych przestrzennych - działki, plany zagospodarowania, granice administracyjne',
      'dataTypes', jsonb_build_array(
        'działki ewidencyjne',
        'adresy',
        'granice administracyjne',
        'plany zagospodarowania przestrzennego',
        'ortofotomapy'
      ),
      'provider', 'Główny Urząd Geodezji i Kartografii',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'geoportal_spatial',
      'useCases', ARRAY[
        'Wyszukiwanie działek po numerze lub lokalizacji',
        'Sprawdzanie MPZP dla nieruchomości',
        'Weryfikacja granic administracyjnych',
        'Geokodowanie adresów'
      ]
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_geoportal_source"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_geoportal_source"() IS 'Funkcja dodająca źródło Geoportal (dane przestrzenne) dla użytkownika';



CREATE OR REPLACE FUNCTION "public"."add_gus_bdl_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- GUS - Bank Danych Lokalnych (API)
  INSERT INTO data_sources (
    user_id, 
    name, 
    type, 
    url, 
    fetch_method,
    scraping_frequency, 
    scraping_enabled, 
    api_config,
    category, 
    tags, 
    priority, 
    jurisdiction, 
    enable_embeddings,
    enable_classification,
    enable_keyword_extraction,
    enable_summarization,
    metadata
  )
  VALUES (
    NEW.id,
    'GUS - Bank Danych Lokalnych',
    'statistics',
    'https://bdl.stat.gov.pl',
    'api',
    'weekly',
    true,
    jsonb_build_object(
      'baseUrl', 'https://bdl.stat.gov.pl/api/v1',
      'requiresAuth', true,
      'authType', 'header',
      'authHeader', 'X-ClientId',
      'endpoints', jsonb_build_object(
        'units', '/units',
        'variables', '/variables',
        'data', '/data',
        'subjects', '/subjects'
      ),
      'rateLimit', jsonb_build_object(
        'maxRequests', 500,
        'window', '15min'
      ),
      'cache', jsonb_build_object(
        'enabled', true,
        'ttl', 86400
      )
    ),
    'statistical',
    ARRAY['GUS', 'statystyki', 'demografia', 'finanse', 'gminy', 'powiaty', 'BDL'],
    'normal',
    'Rzeczpospolita Polska',
    false,  -- Dane statystyczne nie wymagają embeddingów
    false,  -- Nie klasyfikujemy statystyk
    true,   -- Słowa kluczowe mogą być przydatne
    false,  -- Nie generujemy streszczeń
    jsonb_build_object(
      'description', 'Bank Danych Lokalnych - największa w Polsce baza danych statystycznych o gospodarce, społeczeństwie i środowisku',
      'dataTypes', jsonb_build_array(
        'demografia',
        'finanse publiczne',
        'rynek pracy',
        'edukacja',
        'infrastruktura',
        'środowisko',
        'kultura',
        'turystyka'
      ),
      'territorialLevels', jsonb_build_array(
        'Polska',
        'Województwa',
        'Powiaty', 
        'Gminy'
      ),
      'apiDocumentation', 'https://api.stat.gov.pl/Home/BdlApi',
      'registrationRequired', true,
      'registrationUrl', 'https://api.stat.gov.pl/Home/BdlApi'
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_gus_bdl_source"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_isap_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- ISAP - Internetowy System Aktów Prawnych (ELI API)
  INSERT INTO data_sources (
    user_id, 
    name, 
    type, 
    url, 
    fetch_method,
    scraping_frequency, 
    scraping_enabled, 
    api_config,
    category, 
    tags, 
    priority, 
    jurisdiction, 
    enable_embeddings,
    enable_classification,
    enable_keyword_extraction,
    enable_summarization,
    metadata
  )
  VALUES (
    NEW.id,
    'ISAP - Internetowy System Aktów Prawnych',
    'legal',
    'https://isap.sejm.gov.pl',
    'api',
    'daily',
    true,
    jsonb_build_object(
      'baseUrl', 'https://api.sejm.gov.pl/eli',
      'requiresAuth', false,
      'endpoints', jsonb_build_object(
        'acts', '/acts/{publisher}/{year}',
        'actDetails', '/acts/{publisher}/{year}/{position}',
        'actText', '/acts/{publisher}/{year}/{position}/text.html',
        'search', '/acts/{publisher}/{year}?title={query}'
      ),
      'publishers', jsonb_build_array('DU', 'MP'),
      'rateLimit', jsonb_build_object(
        'maxRequests', 100,
        'window', '1min'
      ),
      'documentation', 'https://api.sejm.gov.pl/eli/openapi/ui'
    ),
    'statistical',
    ARRAY['ustawy', 'rozporządzenia', 'dziennik_ustaw', 'monitor_polski', 'prawo', 'legislacja', 'ISAP'],
    'high',
    'Rzeczpospolita Polska',
    true,
    true,
    true,
    true,
    jsonb_build_object(
      'description', 'Oficjalne źródło aktów prawnych RP - Dziennik Ustaw i Monitor Polski',
      'dataTypes', ARRAY['ustawy', 'rozporządzenia', 'obwieszczenia', 'akty wykonawcze'],
      'coverage', 'Akty prawne od 1918 roku',
      'updateFrequency', 'Codziennie',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'isap_legal'
    )
  )
  ON CONFLICT DO NOTHING;
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_isap_source"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_isap_source"() IS 'Funkcja dodająca źródło ISAP (Internetowy System Aktów Prawnych) dla użytkownika';



CREATE OR REPLACE FUNCTION "public"."add_krs_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
    api_config, category, tags, priority, jurisdiction,
    enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
  )
  VALUES (
    NEW.id,
    'KRS - Krajowy Rejestr Sądowy',
    'statistics',
    'https://api-krs.ms.gov.pl',
    'api',
    'daily',
    true,
    jsonb_build_object(
      'endpoints', jsonb_build_object(
        'search', '/api/krs/Wyszukaj',
        'entity', '/api/krs/OdpisAktualny',
        'byNip', '/api/krs/OdpisAktualny/nip',
        'byRegon', '/api/krs/OdpisAktualny/regon'
      ),
      'rateLimit', jsonb_build_object('maxRequests', 50, 'window', '1min'),
      'cache', jsonb_build_object('enabled', true, 'ttl', 3600)
    ),
    'statistical',
    ARRAY['krs', 'spółki', 'stowarzyszenia', 'fundacje', 'przedsiębiorstwa', 'rejestr sądowy'],
    'normal',
    'Rzeczpospolita Polska',
    false, false, true, false,
    jsonb_build_object(
      'description', 'Krajowy Rejestr Sądowy - rejestr przedsiębiorców, stowarzyszeń, fundacji',
      'provider', 'Ministerstwo Sprawiedliwości',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'krs_registry'
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_krs_source"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_teryt_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
    api_config, category, tags, priority, jurisdiction,
    enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
  )
  VALUES (
    NEW.id,
    'TERYT - Rejestr Jednostek Terytorialnych',
    'statistics',
    'https://api-teryt.stat.gov.pl',
    'api',
    'monthly',
    true,
    jsonb_build_object(
      'endpoints', jsonb_build_object(
        'voivodeships', '/api/terc/wojewodztwa',
        'counties', '/api/terc/powiaty',
        'municipalities', '/api/terc/gminy',
        'streets', '/api/simc/ulice'
      ),
      'rateLimit', jsonb_build_object('maxRequests', 100, 'window', '1min'),
      'cache', jsonb_build_object('enabled', true, 'ttl', 86400)
    ),
    'statistical',
    ARRAY['teryt', 'gminy', 'powiaty', 'województwa', 'jednostki terytorialne', 'GUS'],
    'normal',
    'Rzeczpospolita Polska',
    false, false, true, false,
    jsonb_build_object(
      'description', 'Krajowy Rejestr Urzędowy Podziału Terytorialnego Kraju',
      'provider', 'Główny Urząd Statystyczny',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'teryt_registry'
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_teryt_source"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_next_scrape"("frequency" "text", "base_time" timestamp with time zone DEFAULT "now"()) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN CASE frequency
    WHEN 'hourly' THEN base_time + INTERVAL '1 hour'
    WHEN 'daily' THEN base_time + INTERVAL '1 day'
    WHEN 'weekly' THEN base_time + INTERVAL '7 days'
    WHEN 'monthly' THEN base_time + INTERVAL '30 days'
    ELSE NULL -- manual
  END;
END;
$$;


ALTER FUNCTION "public"."calculate_next_scrape"("frequency" "text", "base_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_tokens"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() OR used = true;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_tokens"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_notifications"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM gis_notifications
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND (read_at IS NOT NULL OR dismissed_at IS NOT NULL);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_test_history"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM api_test_history
  WHERE id IN (
    SELECT id
    FROM api_test_history
    WHERE config_id = NEW.config_id
    ORDER BY tested_at DESC
    OFFSET 10
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_test_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_voice_commands"("p_days" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM voice_commands
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_voice_commands"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_api_sources"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- ISAP - Internetowy System Aktów Prawnych (scraping, bo nie ma publicznego API)
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, 
    scraping_frequency, scraping_enabled, scraping_config,
    category, tags, priority, jurisdiction, legal_scope
  )
  VALUES (
    NEW.id,
    'ISAP - Internetowy System Aktów Prawnych',
    'api_isap',
    'https://isap.sejm.gov.pl',
    'scraping',
    'weekly',
    false,
    jsonb_build_object(
      'maxPages', 50,
      'maxDepth', 2,
      'delayMs', 2000,
      'selectors', jsonb_build_object(
        'documentList', '.act-list .act-item, table.acts tr',
        'title', 'h1.act-title, .title',
        'content', '.act-content, .content',
        'date', '.act-date, .date'
      ),
      'urlPatterns', jsonb_build_object(
        'include', jsonb_build_array('isap.sejm.gov.pl'),
        'exclude', jsonb_build_array('login', 'admin')
      )
    ),
    'legal',
    ARRAY['prawo', 'ustawy', 'rozporządzenia', 'ISAP'],
    'high',
    'Rzeczpospolita Polska',
    ARRAY['prawo powszechnie obowiązujące']
  );

  -- Monitor Polski
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method,
    scraping_frequency, scraping_enabled, scraping_config,
    category, tags, priority, jurisdiction, legal_scope
  )
  VALUES (
    NEW.id,
    'Monitor Polski - Dziennik Urzędowy RP',
    'scraper_dziennik',
    'https://monitorpolski.gov.pl',
    'scraping',
    'weekly',
    false,
    jsonb_build_object(
      'maxPages', 30,
      'maxDepth', 2,
      'delayMs', 2000,
      'selectors', jsonb_build_object(
        'documentList', '.document-list .item',
        'title', 'h2.title',
        'content', '.content',
        'date', '.date'
      )
    ),
    'legal',
    ARRAY['Monitor Polski', 'dziennik urzędowy', 'akty wykonawcze'],
    'high',
    'Rzeczpospolita Polska',
    ARRAY['akty wykonawcze']
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_api_sources"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_data_sources"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."create_default_data_sources"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_notification_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO gis_notification_settings (
    user_id,
    email_enabled,
    email_frequency,
    email_types,
    push_enabled,
    push_types,
    inapp_enabled,
    enabled_source_types
  ) VALUES (
    NEW.id,
    true,
    'daily_digest',
    ARRAY['new_document', 'alert', 'urgent'],
    true,
    ARRAY['alert', 'urgent'],
    true,
    ARRAY['municipality', 'bip', 'hospital', 'emergency', 'environmental', 'national_park']
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_notification_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_document_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  source_record RECORD;
  user_settings RECORD;
  notification_id UUID;
BEGIN
  -- Pobierz informacje o źródle
  SELECT ds.*, ds.user_id INTO source_record
  FROM data_sources ds
  WHERE ds.id = (
    SELECT sc.source_id 
    FROM scraped_content sc 
    WHERE sc.id = NEW.scraped_content_id
  );
  
  -- Sprawdź ustawienia użytkownika
  SELECT * INTO user_settings
  FROM gis_notification_settings
  WHERE user_id = NEW.user_id;
  
  -- Jeśli użytkownik nie ma ustawień, utwórz domyślne
  IF user_settings IS NULL THEN
    INSERT INTO gis_notification_settings (user_id)
    VALUES (NEW.user_id)
    RETURNING * INTO user_settings;
  END IF;
  
  -- Sprawdź czy powiadomienia są włączone dla tego typu źródła
  IF user_settings.inapp_enabled 
     AND source_record.type = ANY(user_settings.enabled_source_types)
     AND NOT (source_record.id = ANY(user_settings.muted_sources)) THEN
    
    -- Utwórz powiadomienie
    INSERT INTO gis_notifications (
      user_id,
      source_id,
      document_id,
      notification_type,
      priority,
      title,
      message,
      action_url,
      metadata
    ) VALUES (
      NEW.user_id,
      source_record.id,
      NEW.id,
      'new_document',
      CASE 
        WHEN source_record.type IN ('emergency', 'hospital') THEN 'high'
        WHEN source_record.type IN ('environmental', 'bip') THEN 'normal'
        ELSE 'low'
      END,
      'Nowy dokument: ' || NEW.title,
      'Dodano nowy dokument typu ' || NEW.document_type || ' ze źródła ' || source_record.name,
      '/documents/' || NEW.id::text,
      jsonb_build_object(
        'source_name', source_record.name,
        'source_type', source_record.type,
        'document_type', NEW.document_type,
        'publish_date', NEW.publish_date
      )
    )
    RETURNING id INTO notification_id;
    
    -- Log powiadomienia
    INSERT INTO gis_notification_logs (notification_id, user_id, channel, status)
    VALUES (notification_id, NEW.user_id, 'inapp', 'sent');
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_document_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_document_references"("p_document_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."detect_document_references"("p_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_api_config"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE api_configurations 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_api_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_session_number"("title" "text") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  match_result TEXT;
  roman_num TEXT;
  arabic_num INTEGER;
BEGIN
  -- Próbuj znaleźć numer arabski: "sesja 23", "sesji 23", "Sesja Nr 23"
  match_result := substring(title FROM '(?i)sesj[iaęy]\s+(?:nr\.?\s*)?(\d{1,3})');
  IF match_result IS NOT NULL THEN
    arabic_num := match_result::INTEGER;
    IF arabic_num > 0 AND arabic_num <= 200 THEN
      RETURN arabic_num;
    END IF;
  END IF;
  
  -- Próbuj znaleźć numer rzymski: "Sesja XXIII", "Nr XXIII", "XXIII sesja"
  match_result := substring(title FROM '(?i)(?:sesj[iaęy]\s+(?:nr\.?\s*)?|nr\.?\s*)([IVXLC]{1,10})');
  IF match_result IS NOT NULL THEN
    roman_num := upper(match_result);
    -- Konwersja rzymskich na arabskie
    arabic_num := 0;
    -- Prosta konwersja dla typowych numerów sesji (1-100)
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'C', ''))) * 100;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'XC', ''))) / 2 * 90;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'L', ''))) * 50;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'XL', ''))) / 2 * 40;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'X', ''))) * 10;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'IX', ''))) / 2 * 9;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'V', ''))) * 5;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'IV', ''))) / 2 * 4;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'I', '')));
    
    IF arabic_num > 0 AND arabic_num <= 200 THEN
      RETURN arabic_num;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."extract_session_number"("title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_document_path"("p_source_id" "uuid", "p_target_id" "uuid", "p_max_depth" integer DEFAULT 5) RETURNS TABLE("path" "uuid"[], "depth" integer, "relation_types" "public"."document_relation_type"[], "total_strength" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."find_document_path"("p_source_id" "uuid", "p_target_id" "uuid", "p_max_depth" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_document_path"("p_source_id" "uuid", "p_target_id" "uuid", "p_max_depth" integer) IS 'Znajdź najkrótszą ścieżkę między dwoma dokumentami';



CREATE OR REPLACE FUNCTION "public"."get_related_documents"("p_document_id" "uuid", "p_max_depth" integer DEFAULT 3, "p_min_strength" numeric DEFAULT 0.3) RETURNS TABLE("document_id" "uuid", "depth" integer, "path" "uuid"[], "total_strength" numeric, "relation_types" "public"."document_relation_type"[])
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."get_related_documents"("p_document_id" "uuid", "p_max_depth" integer, "p_min_strength" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_related_documents"("p_document_id" "uuid", "p_max_depth" integer, "p_min_strength" numeric) IS 'Znajdź wszystkie dokumenty powiązane z danym dokumentem (BFS)';



CREATE OR REPLACE FUNCTION "public"."get_unread_notifications"("p_user_id" "uuid", "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "source_name" "text", "notification_type" "text", "priority" "text", "title" "text", "message" "text", "action_url" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    ds.name as source_name,
    n.notification_type,
    n.priority,
    n.title,
    n.message,
    n.action_url,
    n.created_at
  FROM gis_notifications n
  LEFT JOIN data_sources ds ON ds.id = n.source_id
  WHERE n.user_id = p_user_id
    AND n.read_at IS NULL
    AND n.dismissed_at IS NULL
  ORDER BY 
    CASE n.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    n.created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_unread_notifications"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_voice_command_stats"("p_user_id" "uuid", "p_days" integer DEFAULT 30) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_commands', COUNT(*),
    'executed_commands', COUNT(*) FILTER (WHERE executed = true),
    'by_intent', json_object_agg(
      COALESCE(intent, 'unknown'),
      COUNT(*)
    ),
    'avg_confidence', ROUND(AVG(confidence)::numeric, 2),
    'recent_commands', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          transcription,
          intent,
          confidence,
          executed,
          created_at
        FROM voice_commands
        WHERE user_id = p_user_id
          AND created_at >= NOW() - INTERVAL '1 day' * p_days
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    )
  )
  INTO v_result
  FROM voice_commands
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 day' * p_days;
  
  RETURN COALESCE(v_result, '{}'::json);
END;
$$;


ALTER FUNCTION "public"."get_voice_command_stats"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 10, "filter_user_id" "uuid" DEFAULT NULL::"uuid", "semantic_weight" double precision DEFAULT 0.5) RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "document_type" "text", "publish_date" "date", "source_url" "text", "keywords" "text"[], "metadata" "jsonb", "similarity" double precision, "text_rank" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT
      pd.id,
      pd.title,
      pd.content,
      pd.document_type,
      pd.publish_date,
      pd.source_url,
      pd.keywords,
      pd.metadata,
      1 - (pd.embedding <=> query_embedding) AS similarity
    FROM processed_documents pd
    WHERE 
      pd.embedding IS NOT NULL
      AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
      AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ),
  fulltext_results AS (
    SELECT
      pd.id,
      ts_rank(
        to_tsvector('simple', COALESCE(pd.title, '') || ' ' || COALESCE(pd.content, '')),
        plainto_tsquery('simple', query_text)
      ) AS text_rank
    FROM processed_documents pd
    WHERE 
      (filter_user_id IS NULL OR pd.user_id = filter_user_id)
      AND (
        to_tsvector('simple', COALESCE(pd.title, '') || ' ' || COALESCE(pd.content, ''))
        @@ plainto_tsquery('simple', query_text)
      )
  )
  SELECT
    sr.id,
    sr.title,
    sr.content,
    sr.document_type,
    sr.publish_date,
    sr.source_url,
    sr.keywords,
    sr.metadata,
    sr.similarity,
    COALESCE(fr.text_rank, 0) AS text_rank,
    (sr.similarity * semantic_weight + COALESCE(fr.text_rank, 0) * (1 - semantic_weight)) AS combined_score
  FROM semantic_results sr
  LEFT JOIN fulltext_results fr ON sr.id = fr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "semantic_weight" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "semantic_weight" double precision) IS 'Hybrydowe wyszukiwanie łączące semantic search i full-text search';



CREATE OR REPLACE FUNCTION "public"."initialize_user_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name) 
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Użytkownik'))
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO user_notification_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_appearance_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_locale_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_privacy_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_document_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."initialize_user_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_user_action"("p_user_id" "uuid", "p_action" "text", "p_details" "jsonb" DEFAULT NULL::"jsonb", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent)
  VALUES (p_user_id, p_action, p_details, p_ip_address, p_user_agent);
END;
$$;


ALTER FUNCTION "public"."log_user_action"("p_user_id" "uuid", "p_action" "text", "p_details" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notifications_as_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Oznacz wszystkie jako przeczytane
    UPDATE gis_notifications
    SET read_at = NOW()
    WHERE user_id = p_user_id
      AND read_at IS NULL;
  ELSE
    -- Oznacz wybrane jako przeczytane
    UPDATE gis_notifications
    SET read_at = NOW()
    WHERE user_id = p_user_id
      AND id = ANY(p_notification_ids)
      AND read_at IS NULL;
  END IF;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_notifications_as_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 10, "filter_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "document_type" "text", "publish_date" "date", "source_url" "text", "keywords" "text"[], "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.title,
    pd.content,
    pd.document_type,
    pd.publish_date,
    pd.source_url,
    pd.keywords,
    pd.metadata,
    1 - (pd.embedding <=> query_embedding) AS similarity
  FROM processed_documents pd
  WHERE 
    pd.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") IS 'Wyszukiwanie semantyczne dokumentów przez vector similarity';



CREATE OR REPLACE FUNCTION "public"."match_documents_filtered"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 10, "filter_user_id" "uuid" DEFAULT NULL::"uuid", "filter_document_types" "text"[] DEFAULT NULL::"text"[], "filter_date_from" "date" DEFAULT NULL::"date", "filter_date_to" "date" DEFAULT NULL::"date", "filter_keywords" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "document_type" "text", "publish_date" "date", "source_url" "text", "keywords" "text"[], "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.title,
    pd.content,
    pd.document_type,
    pd.publish_date,
    pd.source_url,
    pd.keywords,
    pd.metadata,
    1 - (pd.embedding <=> query_embedding) AS similarity
  FROM processed_documents pd
  WHERE 
    pd.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
    AND (filter_document_types IS NULL OR pd.document_type = ANY(filter_document_types))
    AND (filter_date_from IS NULL OR pd.publish_date >= filter_date_from)
    AND (filter_date_to IS NULL OR pd.publish_date <= filter_date_to)
    AND (filter_keywords IS NULL OR pd.keywords && filter_keywords)
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_documents_filtered"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_document_types" "text"[], "filter_date_from" "date", "filter_date_to" "date", "filter_keywords" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_documents_filtered"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_document_types" "text"[], "filter_date_from" "date", "filter_date_to" "date", "filter_keywords" "text"[]) IS 'Wyszukiwanie semantyczne z filtrami (typy dokumentów, daty, słowa kluczowe)';



CREATE OR REPLACE FUNCTION "public"."normalize_document_title"("title" "text", "session_num" integer) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
DECLARE
  normalized TEXT;
BEGIN
  -- Usuń sufiks " | Urząd Miejski..." i podobne
  normalized := regexp_replace(title, '\s*\|.*$', '', 'i');
  
  -- Usuń "System Rada" i podobne
  normalized := regexp_replace(normalized, '\s*-?\s*System\s+Rada.*$', '', 'i');
  
  -- Jeśli mamy numer sesji, zunifikuj format
  IF session_num IS NOT NULL THEN
    -- Zamień różne formaty na "Sesja X"
    normalized := regexp_replace(normalized, '(?i)sesj[iaęy]\s+(?:nr\.?\s*)?[IVXLC0-9]+', 'Sesja ' || session_num::TEXT, 'g');
  END IF;
  
  -- Trim i normalizacja spacji
  normalized := trim(regexp_replace(normalized, '\s+', ' ', 'g'));
  
  RETURN normalized;
END;
$_$;


ALTER FUNCTION "public"."normalize_document_title"("title" "text", "session_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_source_url"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Remove trailing slashes and normalize URL
  IF NEW.source_url IS NOT NULL THEN
    NEW.source_url = rtrim(trim(NEW.source_url), '/');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."normalize_source_url"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_municipal_data"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.3, "match_count" integer DEFAULT 20, "filter_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "data_type" "text", "source_url" "text", "publish_date" timestamp with time zone, "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    md.id,
    md.title,
    md.content,
    md.data_type,
    md.source_url,
    md.publish_date,
    1 - (md.embedding <=> query_embedding) as similarity
  FROM municipal_data md
  WHERE 
    md.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR md.user_id = filter_user_id)
    AND 1 - (md.embedding <=> query_embedding) > match_threshold
  ORDER BY md.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_municipal_data"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_processed_documents"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.3, "match_count" integer DEFAULT 20, "filter_user_id" "uuid" DEFAULT NULL::"uuid", "filter_types" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "document_type" "text", "title" "text", "content" "text", "summary" "text", "source_url" "text", "publish_date" timestamp with time zone, "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.document_type,
    pd.title,
    pd.content,
    pd.summary,
    pd.source_url,
    pd.publish_date,
    1 - (pd.embedding <=> query_embedding) as similarity
  FROM processed_documents pd
  WHERE 
    pd.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
    AND (filter_types IS NULL OR pd.document_type = ANY(filter_types))
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_processed_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_types" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_voice_macros"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Makro: Poranek radnego
  INSERT INTO voice_macros (user_id, trigger_phrase, description, actions, priority)
  VALUES (
    p_user_id,
    'poranek radnego',
    'Otwiera dashboard, czat i kalendarz',
    '[
      {"type": "navigate", "path": "/dashboard"},
      {"type": "wait", "duration": 500},
      {"type": "tts", "text": "Witaj! Przygotowuję widok poranny."}
    ]'::jsonb,
    10
  ) ON CONFLICT (user_id, trigger_phrase) DO NOTHING;
  
  -- Makro: Sprawdź uchwały
  INSERT INTO voice_macros (user_id, trigger_phrase, description, actions, priority)
  VALUES (
    p_user_id,
    'sprawdź uchwały',
    'Przechodzi do dokumentów i wyszukuje najnowsze uchwały',
    '[
      {"type": "navigate", "path": "/documents"},
      {"type": "wait", "duration": 300},
      {"type": "search", "query": "uchwała", "filter": "recent"}
    ]'::jsonb,
    8
  ) ON CONFLICT (user_id, trigger_phrase) DO NOTHING;
  
  -- Makro: Pomoc
  INSERT INTO voice_macros (user_id, trigger_phrase, description, actions, priority)
  VALUES (
    p_user_id,
    'pomoc głosowa',
    'Wyświetla listę dostępnych komend głosowych',
    '[
      {"type": "tts", "text": "Dostępne komendy: otwórz dokumenty, znajdź uchwałę, zapytaj o budżet, przejdź do ustawień"},
      {"type": "show_help", "category": "voice"}
    ]'::jsonb,
    5
  ) ON CONFLICT (user_id, trigger_phrase) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."seed_default_voice_macros"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_detect_references"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM detect_document_references(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_detect_references"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_background_tasks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_background_tasks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_epuap_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_epuap_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_next_scrape_time"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.scraping_enabled THEN
    NEW.next_scrape_at := calculate_next_scrape(NEW.scraping_frequency, COALESCE(NEW.last_scraped_at, NOW()));
  ELSE
    NEW.next_scrape_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_next_scrape_time"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_ai_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_ai_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_voice_macro_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_voice_macro_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_api_config"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Jeśli fetch_method to 'api' lub 'hybrid', api_config musi być ustawiony
  IF NEW.fetch_method IN ('api', 'hybrid') AND NEW.api_config IS NULL THEN
    RAISE EXCEPTION 'api_config is required when fetch_method is api or hybrid';
  END IF;
  
  -- Jeśli fetch_method to 'scraping' lub 'hybrid', scraping_config musi być ustawiony
  IF NEW.fetch_method IN ('scraping', 'hybrid') AND NEW.scraping_config IS NULL THEN
    RAISE EXCEPTION 'scraping_config is required when fetch_method is scraping or hybrid';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_api_config"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."api_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "api_key_encrypted" "text" NOT NULL,
    "base_url" "text",
    "model_name" character varying(100),
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "embedding_model" character varying(100) DEFAULT 'text-embedding-3-small'::character varying,
    "provider_version" character varying(20),
    "encryption_iv" "text",
    "chat_endpoint" "text",
    "embeddings_endpoint" "text",
    "models_endpoint" "text",
    "auth_method" character varying(20) DEFAULT 'bearer'::character varying,
    "custom_headers" "jsonb",
    "timeout_seconds" integer DEFAULT 30,
    "max_retries" integer DEFAULT 3,
    "connection_status" character varying(20) DEFAULT 'untested'::character varying,
    "last_test_at" timestamp with time zone,
    "last_test_result" "jsonb",
    "transcription_model" character varying(100) DEFAULT 'whisper-1'::character varying,
    "config_type" "text" DEFAULT 'ai'::"text" NOT NULL,
    "search_endpoint" "text",
    "results_limit" integer DEFAULT 5,
    "provider_meta" "jsonb",
    "vision_model" character varying(100),
    "tts_model" character varying(100),
    CONSTRAINT "api_configurations_config_type_check" CHECK (("config_type" = ANY (ARRAY['ai'::"text", 'semantic'::"text"]))),
    CONSTRAINT "api_configurations_provider_check" CHECK ((("provider")::"text" = ANY ((ARRAY['openai'::character varying, 'local'::character varying, 'azure'::character varying, 'anthropic'::character varying, 'other'::character varying, 'exa'::character varying, 'perplexity'::character varying, 'tavily'::character varying, 'brave'::character varying, 'serper'::character varying, 'firecrawl'::character varying])::"text"[]))),
    CONSTRAINT "check_auth_method" CHECK ((("auth_method")::"text" = ANY ((ARRAY['bearer'::character varying, 'api-key'::character varying, 'oauth'::character varying, 'custom'::character varying])::"text"[]))),
    CONSTRAINT "check_connection_status" CHECK ((("connection_status")::"text" = ANY ((ARRAY['untested'::character varying, 'working'::character varying, 'failed'::character varying, 'testing'::character varying])::"text"[])))
);


ALTER TABLE "public"."api_configurations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."api_configurations"."provider" IS 'Provider API: openai, local, azure, anthropic, google, moonshot, deepseek, qwen, zhipu, baichuan, mistral, cohere, together, groq, exa, tavily, serper, firecrawl, other';



COMMENT ON COLUMN "public"."api_configurations"."embedding_model" IS 'Model do generowania embeddingów (np. text-embedding-3-small)';



COMMENT ON COLUMN "public"."api_configurations"."provider_version" IS 'API version for the provider (e.g., v1, v1beta)';



COMMENT ON COLUMN "public"."api_configurations"."encryption_iv" IS 'Initialization vector for AES-256-GCM encryption';



COMMENT ON COLUMN "public"."api_configurations"."auth_method" IS 'Authentication method: bearer, api-key, oauth, custom';



COMMENT ON COLUMN "public"."api_configurations"."connection_status" IS 'Status połączenia: unknown, working, failed';



COMMENT ON COLUMN "public"."api_configurations"."last_test_result" IS 'JSON with details of last connection test';



COMMENT ON COLUMN "public"."api_configurations"."transcription_model" IS 'Model do transkrypcji audio (np. whisper-1)';



COMMENT ON COLUMN "public"."api_configurations"."config_type" IS 'Typ konfiguracji: ai (modele AI) lub semantic (wyszukiwanie semantyczne)';



COMMENT ON COLUMN "public"."api_configurations"."vision_model" IS 'Model do analizy obrazów (np. gpt-4-vision)';



COMMENT ON COLUMN "public"."api_configurations"."tts_model" IS 'Model do syntezy mowy (np. tts-1)';



CREATE TABLE IF NOT EXISTS "public"."api_test_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "config_id" "uuid" NOT NULL,
    "test_type" character varying(20) NOT NULL,
    "status" character varying(20) NOT NULL,
    "response_time_ms" integer,
    "error_message" "text",
    "error_details" "jsonb",
    "tested_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_test_status" CHECK ((("status")::"text" = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'timeout'::character varying, 'error'::character varying])::"text"[]))),
    CONSTRAINT "check_test_type" CHECK ((("test_type")::"text" = ANY ((ARRAY['connection'::character varying, 'chat'::character varying, 'embeddings'::character varying, 'models'::character varying, 'full'::character varying])::"text"[])))
);


ALTER TABLE "public"."api_test_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."api_test_history" IS 'History of connection tests for API configurations';



COMMENT ON COLUMN "public"."api_test_history"."test_type" IS 'Type of test: connection, chat, embeddings, models, full';



COMMENT ON COLUMN "public"."api_test_history"."status" IS 'Test result: success, failed, timeout, error';



COMMENT ON COLUMN "public"."api_test_history"."response_time_ms" IS 'Response time in milliseconds';



COMMENT ON COLUMN "public"."api_test_history"."error_details" IS 'JSON with detailed error information';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."background_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "progress" integer DEFAULT 0,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "background_tasks_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "background_tasks_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "background_tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['transcription'::"text", 'ocr'::"text", 'scraping'::"text", 'embedding'::"text", 'analysis'::"text"])))
);


ALTER TABLE "public"."background_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."background_tasks" IS 'Tabela do śledzenia zadań w tle z Supabase Realtime';



CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "google_event_id" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "location" "text",
    "attendees" "jsonb" DEFAULT '[]'::"jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."calendar_events" IS 'Wydarzenia z kalendarza Google';



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'Historia konwersacji użytkowników z AI';



CREATE TABLE IF NOT EXISTS "public"."data_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "scraping_enabled" boolean DEFAULT true,
    "scraping_frequency" "text" DEFAULT 'daily'::"text",
    "last_scraped_at" timestamp with time zone,
    "next_scrape_at" timestamp with time zone,
    "scraping_config" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "fetch_method" "text" DEFAULT 'scraping'::"text",
    "api_config" "jsonb",
    "category" "text" DEFAULT 'other'::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "priority" "text" DEFAULT 'normal'::"text",
    "jurisdiction" "text",
    "legal_scope" "text"[],
    "enable_embeddings" boolean DEFAULT true,
    "enable_classification" boolean DEFAULT true,
    "enable_keyword_extraction" boolean DEFAULT true,
    "enable_summarization" boolean DEFAULT false,
    "cron_expression" "text",
    "last_success_at" timestamp with time zone,
    "last_error_at" timestamp with time zone,
    "last_error_message" "text",
    CONSTRAINT "data_sources_category_check" CHECK (("category" = ANY (ARRAY['legal'::"text", 'administrative'::"text", 'financial'::"text", 'statistical'::"text", 'other'::"text"]))),
    CONSTRAINT "data_sources_fetch_method_check" CHECK (("fetch_method" = ANY (ARRAY['api'::"text", 'scraping'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "data_sources_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "data_sources_scraping_frequency_check" CHECK (("scraping_frequency" = ANY (ARRAY['hourly'::"text", 'daily'::"text", 'weekly'::"text", 'monthly'::"text", 'manual'::"text"]))),
    CONSTRAINT "data_sources_type_check" CHECK (("type" = ANY (ARRAY['municipality'::"text", 'bip'::"text", 'legal'::"text", 'councilor'::"text", 'statistics'::"text", 'national_park'::"text", 'hospital'::"text", 'school'::"text", 'cultural'::"text", 'environmental'::"text", 'transport'::"text", 'emergency'::"text", 'custom'::"text", 'api_isap'::"text", 'api_rcl'::"text", 'api_wsa_nsa'::"text", 'api_rio'::"text", 'api_custom'::"text", 'scraper_bip'::"text", 'scraper_dziennik'::"text", 'scraper_custom'::"text", 'youtube'::"text", 'spatial'::"text", 'funding'::"text"])))
);


ALTER TABLE "public"."data_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_sources" IS 'Konfiguracja źródeł danych do scrapingu';



COMMENT ON COLUMN "public"."data_sources"."type" IS 'Typ źródła danych - legacy types, API/scraper types, multimedia (youtube), spatial (geoportal), funding (EU funds)';



COMMENT ON COLUMN "public"."data_sources"."scraping_enabled" IS 'Czy scraping jest włączony dla tego źródła';



COMMENT ON COLUMN "public"."data_sources"."scraping_frequency" IS 'Częstotliwość scrapingu: hourly, daily, weekly, monthly, manual';



COMMENT ON COLUMN "public"."data_sources"."scraping_config" IS 'Konfiguracja scrapingu (selektory CSS, paginacja) w formacie JSONB';



COMMENT ON COLUMN "public"."data_sources"."fetch_method" IS 'Metoda pobierania: api, scraping, hybrid';



COMMENT ON COLUMN "public"."data_sources"."api_config" IS 'Konfiguracja API client: baseUrl, requiresAuth, authType, authHeader, endpoints, rateLimit, cache';



COMMENT ON COLUMN "public"."data_sources"."category" IS 'Kategoria źródła: legal, administrative, financial, statistical, other';



COMMENT ON COLUMN "public"."data_sources"."tags" IS 'Tagi dla łatwiejszego wyszukiwania i filtrowania';



COMMENT ON COLUMN "public"."data_sources"."priority" IS 'Priorytet źródła: low, normal, high, critical';



COMMENT ON COLUMN "public"."data_sources"."jurisdiction" IS 'Jurysdykcja (np. gmina Drawno, województwo zachodniopomorskie)';



COMMENT ON COLUMN "public"."data_sources"."legal_scope" IS 'Zakres prawny (np. budżet, podatki, planowanie przestrzenne)';



COMMENT ON COLUMN "public"."data_sources"."enable_embeddings" IS 'Czy generować embeddingi dla dokumentów z tego źródła';



COMMENT ON COLUMN "public"."data_sources"."enable_classification" IS 'Czy klasyfikować dokumenty z tego źródła';



COMMENT ON COLUMN "public"."data_sources"."enable_keyword_extraction" IS 'Czy wyciągać słowa kluczowe z dokumentów';



COMMENT ON COLUMN "public"."data_sources"."enable_summarization" IS 'Czy generować streszczenia dokumentów';



CREATE TABLE IF NOT EXISTS "public"."document_cluster_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cluster_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "depth" integer DEFAULT 0,
    "parent_document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_cluster_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_clusters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(200) NOT NULL,
    "description" "text",
    "cluster_type" character varying(50) DEFAULT 'auto'::character varying,
    "root_document_id" "uuid",
    "document_count" integer DEFAULT 0,
    "total_strength" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_clusters" OWNER TO "postgres";


COMMENT ON TABLE "public"."document_clusters" IS 'Klastry powiązanych dokumentów';



CREATE TABLE IF NOT EXISTS "public"."document_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_document_id" "uuid" NOT NULL,
    "target_document_id" "uuid" NOT NULL,
    "relation_type" "public"."document_relation_type" DEFAULT 'related'::"public"."document_relation_type" NOT NULL,
    "strength" numeric(3,2) DEFAULT 1.0,
    "context" "text",
    "reference_text" character varying(500),
    "detected_automatically" boolean DEFAULT true,
    "verified_by_user" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "document_relations_strength_check" CHECK ((("strength" >= (0)::numeric) AND ("strength" <= (1)::numeric)))
);


ALTER TABLE "public"."document_relations" OWNER TO "postgres";


COMMENT ON TABLE "public"."document_relations" IS 'Graf powiązań między dokumentami - krawędzie';



CREATE TABLE IF NOT EXISTS "public"."processed_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scraped_content_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "summary" "text",
    "keywords" "text"[],
    "publish_date" timestamp with time zone,
    "source_url" "text",
    "embedding" "public"."vector"(1024),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "session_number" integer,
    "normalized_title" character varying(500),
    "normalized_publish_date" "date",
    "document_number" character varying(100),
    "session_type" character varying(50),
    "normalization_confidence" integer DEFAULT 0,
    "is_normalized" boolean DEFAULT false,
    CONSTRAINT "chk_source_url_not_empty" CHECK ((("source_url" IS NULL) OR ("length"(TRIM(BOTH FROM "source_url")) > 0)))
);


ALTER TABLE "public"."processed_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."processed_documents" IS 'Przetworzone dokumenty z embeddings';



CREATE OR REPLACE VIEW "public"."document_graph_stats" WITH ("security_invoker"='on') AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."processed_documents") AS "total_documents",
    ( SELECT "count"(*) AS "count"
           FROM "public"."document_relations") AS "total_relations",
    ( SELECT "count"(*) AS "count"
           FROM "public"."document_clusters") AS "total_clusters",
    ( SELECT "count"(DISTINCT "document_relations"."source_document_id") AS "count"
           FROM "public"."document_relations") AS "documents_with_outgoing",
    ( SELECT "count"(DISTINCT "document_relations"."target_document_id") AS "count"
           FROM "public"."document_relations") AS "documents_with_incoming",
    ( SELECT "avg"("document_relations"."strength") AS "avg"
           FROM "public"."document_relations") AS "avg_relation_strength";


ALTER VIEW "public"."document_graph_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "progress" integer DEFAULT 0,
    "result" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "document_jobs_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "document_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."document_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."epuap_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "epuap_message_id" "text" NOT NULL,
    "sender" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "content" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "received_at" timestamp with time zone NOT NULL,
    "read_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "document_type" "text",
    "case_number" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "epuap_messages_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'read'::"text", 'processed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."epuap_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."epuap_messages" IS 'Wiadomości z ePUAP zsynchronizowane dla użytkowników';



COMMENT ON COLUMN "public"."epuap_messages"."epuap_message_id" IS 'ID wiadomości w systemie ePUAP';



COMMENT ON COLUMN "public"."epuap_messages"."status" IS 'Status: new, read, processed, archived';



CREATE TABLE IF NOT EXISTS "public"."generated_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "report_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "summary" "text",
    "pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."generated_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."generated_reports" IS 'Wygenerowane raporty';



CREATE TABLE IF NOT EXISTS "public"."gis_notification_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gis_notification_logs_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'push'::"text", 'inapp'::"text", 'sms'::"text"]))),
    CONSTRAINT "gis_notification_logs_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'queued'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."gis_notification_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."gis_notification_logs" IS 'Logi wysłanych powiadomień';



CREATE TABLE IF NOT EXISTS "public"."gis_notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_enabled" boolean DEFAULT true,
    "email_frequency" "text" DEFAULT 'immediate'::"text",
    "email_types" "text"[] DEFAULT ARRAY['new_document'::"text", 'alert'::"text", 'urgent'::"text"],
    "push_enabled" boolean DEFAULT true,
    "push_types" "text"[] DEFAULT ARRAY['alert'::"text", 'urgent'::"text"],
    "inapp_enabled" boolean DEFAULT true,
    "enabled_source_types" "text"[] DEFAULT ARRAY['municipality'::"text", 'bip'::"text", 'hospital'::"text", 'emergency'::"text", 'environmental'::"text"],
    "muted_sources" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "quiet_hours_enabled" boolean DEFAULT false,
    "quiet_hours_start" time without time zone DEFAULT '22:00:00'::time without time zone,
    "quiet_hours_end" time without time zone DEFAULT '07:00:00'::time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gis_notification_settings_email_frequency_check" CHECK (("email_frequency" = ANY (ARRAY['immediate'::"text", 'daily_digest'::"text", 'weekly_digest'::"text", 'never'::"text"])))
);


ALTER TABLE "public"."gis_notification_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."gis_notification_settings" IS 'Ustawienia powiadomień użytkownika';



CREATE TABLE IF NOT EXISTS "public"."gis_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_id" "uuid",
    "document_id" "uuid",
    "notification_type" "text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text",
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "action_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gis_notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['new_document'::"text", 'update'::"text", 'alert'::"text", 'reminder'::"text", 'system'::"text"]))),
    CONSTRAINT "gis_notifications_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."gis_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."gis_notifications" IS 'Powiadomienia GIS o nowościach z instytucji';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "citations" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Wiadomości w konwersacjach';



CREATE TABLE IF NOT EXISTS "public"."municipal_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "data_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "source_url" "text",
    "meeting_date" timestamp with time zone,
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding" "public"."vector"(1024)
);


ALTER TABLE "public"."municipal_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."municipal_data" IS 'Dane ze strony gminy/miasta (scraping)';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Powiadomienia in-app dla użytkowników';



CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_active" boolean DEFAULT true,
    "force_password_change" boolean DEFAULT false,
    "last_login" timestamp with time zone,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'radny'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_capabilities" (
    "provider" character varying(50) NOT NULL,
    "supports_chat" boolean DEFAULT true,
    "supports_embeddings" boolean DEFAULT false,
    "supports_streaming" boolean DEFAULT true,
    "supports_function_calling" boolean DEFAULT false,
    "supports_vision" boolean DEFAULT false,
    "auth_methods" "text"[] DEFAULT ARRAY['bearer'::"text"],
    "default_base_url" "text",
    "default_chat_endpoint" "text",
    "default_embeddings_endpoint" "text",
    "default_models_endpoint" "text",
    "rate_limit_rpm" integer,
    "rate_limit_tpm" integer,
    "documentation_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_capabilities" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_capabilities" IS 'Capabilities i konfiguracja domyślna dla wszystkich providerów (LLM + Deep Research)';



COMMENT ON COLUMN "public"."provider_capabilities"."auth_methods" IS 'Array of supported authentication methods';



COMMENT ON COLUMN "public"."provider_capabilities"."rate_limit_rpm" IS 'Rate limit in requests per minute';



COMMENT ON COLUMN "public"."provider_capabilities"."rate_limit_tpm" IS 'Rate limit in tokens per minute';



CREATE TABLE IF NOT EXISTS "public"."report_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "report_type" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "day_of_week" integer,
    "day_of_month" integer,
    "time_of_day" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "email_notification" boolean DEFAULT true,
    "in_app_notification" boolean DEFAULT true,
    "last_run_at" timestamp with time zone,
    "next_run_at" timestamp with time zone NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "report_schedules_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31))),
    CONSTRAINT "report_schedules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "report_schedules_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "report_schedules_report_type_check" CHECK (("report_type" = ANY (ARRAY['documents'::"text", 'sessions'::"text", 'budget'::"text", 'activity'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."report_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."report_schedules" IS 'Harmonogramy raportów cyklicznych';



CREATE TABLE IF NOT EXISTS "public"."research_reports" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "query" "text" NOT NULL,
    "research_type" "text" NOT NULL,
    "depth" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "key_findings" "text"[] DEFAULT '{}'::"text"[],
    "results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "related_queries" "text"[] DEFAULT '{}'::"text"[],
    "confidence" numeric(3,2) DEFAULT 0.0 NOT NULL,
    "processing_time" integer NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "research_reports_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "research_reports_depth_check" CHECK (("depth" = ANY (ARRAY['quick'::"text", 'standard'::"text", 'deep'::"text"]))),
    CONSTRAINT "research_reports_research_type_check" CHECK (("research_type" = ANY (ARRAY['legal'::"text", 'financial'::"text", 'procedural'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."research_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."research_reports" IS 'Raporty z Deep Internet Researcher - zaawansowany research internetowy';



COMMENT ON COLUMN "public"."research_reports"."query" IS 'Zapytanie użytkownika';



COMMENT ON COLUMN "public"."research_reports"."research_type" IS 'Typ researchu: legal, financial, procedural, general';



COMMENT ON COLUMN "public"."research_reports"."depth" IS 'Głębokość researchu: quick (5 źródeł), standard (20), deep (50+)';



COMMENT ON COLUMN "public"."research_reports"."summary" IS 'Podsumowanie wygenerowane przez AI';



COMMENT ON COLUMN "public"."research_reports"."key_findings" IS 'Kluczowe ustalenia (3-5 punktów)';



COMMENT ON COLUMN "public"."research_reports"."results" IS 'Wyniki researchu w formacie JSON';



COMMENT ON COLUMN "public"."research_reports"."sources" IS 'Statystyki źródeł (provider, count, avg_relevance)';



COMMENT ON COLUMN "public"."research_reports"."related_queries" IS 'Powiązane zapytania sugerowane przez AI';



COMMENT ON COLUMN "public"."research_reports"."confidence" IS 'Poziom pewności wyniku (0-1)';



COMMENT ON COLUMN "public"."research_reports"."processing_time" IS 'Czas przetwarzania w milisekundach';



CREATE TABLE IF NOT EXISTS "public"."scraped_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "title" "text",
    "content_type" "text" DEFAULT 'html'::"text",
    "raw_content" "text",
    "content_hash" "text",
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "pdf_links" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "scraped_content_content_type_check" CHECK (("content_type" = ANY (ARRAY['html'::"text", 'pdf'::"text", 'json'::"text", 'xml'::"text", 'text'::"text"])))
);


ALTER TABLE "public"."scraped_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."scraped_content" IS 'Surowe dane pobrane ze źródeł';



CREATE TABLE IF NOT EXISTS "public"."scraping_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "items_scraped" integer DEFAULT 0,
    "items_processed" integer DEFAULT 0,
    "error_message" "text",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "items_fetched" integer DEFAULT 0,
    CONSTRAINT "scraping_logs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'error'::"text", 'partial'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."scraping_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."scraping_logs" IS 'Logi operacji scrapingu';



COMMENT ON COLUMN "public"."scraping_logs"."items_scraped" IS 'Liczba zescrapowanych elementów';



COMMENT ON COLUMN "public"."scraping_logs"."items_processed" IS 'Liczba przetworzonych elementów';



COMMENT ON COLUMN "public"."scraping_logs"."items_fetched" IS 'Liczba pobranych elementów (alias dla items_scraped)';



CREATE TABLE IF NOT EXISTS "public"."transcription_jobs" (
    "id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "video_url" "text" NOT NULL,
    "video_title" "text" NOT NULL,
    "session_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "progress_message" "text",
    "include_sentiment" boolean DEFAULT true NOT NULL,
    "identify_speakers" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "error" "text",
    "result_document_id" "uuid",
    "audio_issues" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "public"."transcription_jobs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."upcoming_sessions" WITH ("security_invoker"='on') AS
 SELECT "id",
    "user_id",
    "title",
    "document_type",
    "session_number",
    "normalized_publish_date" AS "event_date",
    "source_url",
    'session'::"text" AS "event_type"
   FROM "public"."processed_documents"
  WHERE (("document_type" = ANY (ARRAY['session_agenda'::"text", 'session_protocol'::"text", 'committee_meeting'::"text"])) AND ("normalized_publish_date" >= CURRENT_DATE))
  ORDER BY "normalized_publish_date";


ALTER VIEW "public"."upcoming_sessions" OWNER TO "postgres";


COMMENT ON VIEW "public"."upcoming_sessions" IS 'Nadchodzące sesje i posiedzenia komisji z dokumentów';



CREATE TABLE IF NOT EXISTS "public"."user_ai_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assistant_name" "text" DEFAULT 'Asystent'::"text",
    "response_style" "text" DEFAULT 'formal'::"text",
    "personality" "text",
    "special_instructions" "text",
    "temperature" numeric(2,1) DEFAULT 0.7,
    "max_tokens" integer DEFAULT 2048,
    "include_emoji" boolean DEFAULT false,
    "language" "text" DEFAULT 'pl'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_ai_settings_language_check" CHECK (("language" = ANY (ARRAY['pl'::"text", 'en'::"text"]))),
    CONSTRAINT "user_ai_settings_max_tokens_check" CHECK ((("max_tokens" > 0) AND ("max_tokens" <= 8192))),
    CONSTRAINT "user_ai_settings_response_style_check" CHECK (("response_style" = ANY (ARRAY['formal'::"text", 'casual'::"text", 'concise'::"text", 'detailed'::"text"]))),
    CONSTRAINT "user_ai_settings_temperature_check" CHECK ((("temperature" >= (0)::numeric) AND ("temperature" <= (1)::numeric)))
);


ALTER TABLE "public"."user_ai_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_ai_settings" IS 'Ustawienia personalizacji AI dla użytkowników';



COMMENT ON COLUMN "public"."user_ai_settings"."response_style" IS 'Styl odpowiedzi: formal, casual, concise, detailed';



COMMENT ON COLUMN "public"."user_ai_settings"."personality" IS 'Opis osobowości asystenta AI';



COMMENT ON COLUMN "public"."user_ai_settings"."special_instructions" IS 'Specjalne instrukcje dla AI';



COMMENT ON COLUMN "public"."user_ai_settings"."temperature" IS 'Parametr kreatywności (0-1)';



COMMENT ON COLUMN "public"."user_ai_settings"."include_emoji" IS 'Czy używać emoji w odpowiedziach';



CREATE TABLE IF NOT EXISTS "public"."user_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(300) NOT NULL,
    "message" "text",
    "alert_type" character varying(30) DEFAULT 'info'::character varying NOT NULL,
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "is_dismissed" boolean DEFAULT false,
    "document_id" "uuid",
    "task_id" "uuid",
    "calendar_event_id" "uuid",
    "action_url" "text",
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_alerts_alert_type_check" CHECK ((("alert_type")::"text" = ANY ((ARRAY['session'::character varying, 'deadline'::character varying, 'document'::character varying, 'budget'::character varying, 'interpellation'::character varying, 'info'::character varying, 'warning'::character varying, 'error'::character varying])::"text"[]))),
    CONSTRAINT "user_alerts_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_alerts" IS 'Powiadomienia i alerty dla radnego';



CREATE TABLE IF NOT EXISTS "public"."user_appearance_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "theme" character varying(20) DEFAULT 'light'::character varying,
    "font_size" character varying(20) DEFAULT 'medium'::character varying,
    "compact_mode" boolean DEFAULT false,
    "sidebar_collapsed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_appearance_settings_font_size_check" CHECK ((("font_size")::"text" = ANY ((ARRAY['small'::character varying, 'medium'::character varying, 'large'::character varying])::"text"[]))),
    CONSTRAINT "user_appearance_settings_theme_check" CHECK ((("theme")::"text" = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'system'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_appearance_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(500) NOT NULL,
    "description" "text",
    "event_type" character varying(50) DEFAULT 'other'::character varying NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "all_day" boolean DEFAULT false,
    "location" character varying(300),
    "document_id" "uuid",
    "source_url" "text",
    "reminder_minutes" integer[] DEFAULT '{1440,60}'::integer[],
    "reminder_sent" boolean DEFAULT false,
    "color" character varying(20) DEFAULT 'primary'::character varying,
    "is_auto_imported" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_calendar_events_event_type_check" CHECK ((("event_type")::"text" = ANY ((ARRAY['session'::character varying, 'committee'::character varying, 'meeting'::character varying, 'deadline'::character varying, 'reminder'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_calendar_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_calendar_events" IS 'Kalendarz-organizer radnego z wydarzeniami';



CREATE TABLE IF NOT EXISTS "public"."user_document_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "default_sort_by" character varying(30) DEFAULT 'chronological'::character varying,
    "default_sort_order" character varying(10) DEFAULT 'desc'::character varying,
    "default_document_types" "text"[] DEFAULT '{}'::"text"[],
    "show_only_my_committees" boolean DEFAULT false,
    "group_by_session" boolean DEFAULT true,
    "show_related_documents" boolean DEFAULT true,
    "default_view" character varying(20) DEFAULT 'list'::character varying,
    "items_per_page" integer DEFAULT 20,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_grouping_scheme" character varying(30) DEFAULT 'cascade'::character varying,
    "default_document_type" character varying(50) DEFAULT NULL::character varying,
    "default_priority" character varying(20) DEFAULT NULL::character varying,
    "default_date_range" character varying(20) DEFAULT NULL::character varying,
    CONSTRAINT "user_document_preferences_default_date_range_check" CHECK ((("default_date_range" IS NULL) OR (("default_date_range")::"text" = ANY ((ARRAY['week'::character varying, 'month'::character varying, 'year'::character varying])::"text"[])))),
    CONSTRAINT "user_document_preferences_default_grouping_scheme_check" CHECK ((("default_grouping_scheme")::"text" = ANY ((ARRAY['flat'::character varying, 'cascade'::character varying, 'by_type'::character varying, 'by_date'::character varying, 'by_reference'::character varying])::"text"[]))),
    CONSTRAINT "user_document_preferences_default_priority_check" CHECK ((("default_priority" IS NULL) OR (("default_priority")::"text" = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::"text"[])))),
    CONSTRAINT "user_document_preferences_default_sort_by_check" CHECK ((("default_sort_by")::"text" = ANY ((ARRAY['date'::character varying, 'title'::character varying, 'number'::character varying, 'score'::character varying, 'chronological'::character varying, 'priority'::character varying, 'type'::character varying, 'relevance'::character varying])::"text"[]))),
    CONSTRAINT "user_document_preferences_default_sort_order_check" CHECK ((("default_sort_order")::"text" = ANY ((ARRAY['asc'::character varying, 'desc'::character varying])::"text"[]))),
    CONSTRAINT "user_document_preferences_default_view_check" CHECK ((("default_view")::"text" = ANY ((ARRAY['list'::character varying, 'grid'::character varying, 'timeline'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_document_preferences" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_document_preferences"."default_grouping_scheme" IS 'Schemat grupowania dokumentów: flat (płaska lista), cascade (sesje/komisje), by_type (typ dokumentu), by_date (data), by_reference (powiązania)';



COMMENT ON COLUMN "public"."user_document_preferences"."default_document_type" IS 'Domyślny typ dokumentu do filtrowania, np. resolution, protocol, news';



COMMENT ON COLUMN "public"."user_document_preferences"."default_priority" IS 'Domyślny priorytet do filtrowania: critical, high, medium, low';



COMMENT ON COLUMN "public"."user_document_preferences"."default_date_range" IS 'Domyślny zakres dat: week, month, year';



CREATE TABLE IF NOT EXISTS "public"."user_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "integration_type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "enabled" boolean DEFAULT true,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_integrations" IS 'Konfiguracje integracji zewnętrznych (ePUAP, Google Calendar, etc.)';



CREATE TABLE IF NOT EXISTS "public"."user_locale_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "language" character varying(10) DEFAULT 'pl'::character varying,
    "timezone" character varying(50) DEFAULT 'Europe/Warsaw'::character varying,
    "date_format" character varying(20) DEFAULT 'DD.MM.YYYY'::character varying,
    "time_format" character varying(10) DEFAULT '24h'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "municipality" character varying(100) DEFAULT NULL::character varying,
    "voivodeship" character varying(50) DEFAULT NULL::character varying,
    "bip_url" "text",
    "council_name" character varying(200) DEFAULT NULL::character varying,
    "postal_code" "text",
    "county" "text",
    CONSTRAINT "user_locale_settings_time_format_check" CHECK ((("time_format")::"text" = ANY ((ARRAY['12h'::character varying, '24h'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_locale_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_locale_settings"."municipality" IS 'Gmina/Miasto użytkownika';



COMMENT ON COLUMN "public"."user_locale_settings"."voivodeship" IS 'Województwo';



COMMENT ON COLUMN "public"."user_locale_settings"."bip_url" IS 'URL do BIP gminy/miasta';



COMMENT ON COLUMN "public"."user_locale_settings"."council_name" IS 'Pełna nazwa rady, np. Rada Miejska w Białobrzegach';



CREATE TABLE IF NOT EXISTS "public"."user_notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_new_document" boolean DEFAULT true,
    "email_analysis_complete" boolean DEFAULT true,
    "email_weekly_report" boolean DEFAULT false,
    "push_new_document" boolean DEFAULT true,
    "push_analysis_complete" boolean DEFAULT false,
    "push_chat_mention" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_privacy_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profile_visibility" character varying(20) DEFAULT 'team'::character varying,
    "activity_tracking" boolean DEFAULT true,
    "analytics_consent" boolean DEFAULT true,
    "auto_delete_chats_after_days" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_privacy_settings_profile_visibility_check" CHECK ((("profile_visibility")::"text" = ANY ((ARRAY['public'::character varying, 'team'::character varying, 'private'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_privacy_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "phone" character varying(50),
    "position" character varying(100),
    "department" character varying(100),
    "avatar_url" "text",
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "municipality_name" "text",
    "municipality_type" "text",
    "bip_url" "text",
    "council_page_url" "text",
    "scraping_enabled" boolean DEFAULT false,
    "scraping_frequency" "text" DEFAULT 'daily'::"text",
    "role_in_council" character varying(50) DEFAULT NULL::character varying,
    "committees" "text"[] DEFAULT '{}'::"text"[],
    "council_term" character varying(20) DEFAULT NULL::character varying,
    CONSTRAINT "user_profiles_municipality_type_check" CHECK (("municipality_type" = ANY (ARRAY['gmina'::"text", 'miasto'::"text", 'powiat'::"text"]))),
    CONSTRAINT "user_profiles_scraping_frequency_check" CHECK (("scraping_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."role_in_council" IS 'Rola w radzie: radny, przewodniczący, wiceprzewodniczący, etc.';



COMMENT ON COLUMN "public"."user_profiles"."committees" IS 'Lista komisji do których należy radny';



COMMENT ON COLUMN "public"."user_profiles"."council_term" IS 'Kadencja rady, np. 2024-2029';



CREATE OR REPLACE VIEW "public"."user_settings_complete" AS
 SELECT "u"."id" AS "user_id",
    "u"."email",
    "p"."full_name",
    "p"."phone",
    "p"."position",
    "p"."department",
    "p"."avatar_url",
    "p"."bio",
    "p"."role_in_council",
    "p"."committees",
    "p"."council_term",
    "n"."email_new_document",
    "n"."email_analysis_complete",
    "n"."email_weekly_report",
    "n"."push_new_document",
    "n"."push_analysis_complete",
    "n"."push_chat_mention",
    "a"."theme",
    "a"."font_size",
    "a"."compact_mode",
    "a"."sidebar_collapsed",
    "l"."language",
    "l"."timezone",
    "l"."date_format",
    "l"."time_format",
    "l"."municipality",
    "l"."voivodeship",
    "l"."bip_url",
    "l"."council_name",
    "pr"."profile_visibility",
    "pr"."activity_tracking",
    "pr"."analytics_consent",
    "pr"."auto_delete_chats_after_days",
    "dp"."default_sort_by",
    "dp"."default_sort_order",
    "dp"."default_document_types",
    "dp"."show_only_my_committees",
    "dp"."group_by_session",
    "dp"."show_related_documents",
    "dp"."default_view",
    "dp"."items_per_page"
   FROM (((((("auth"."users" "u"
     LEFT JOIN "public"."user_profiles" "p" ON (("u"."id" = "p"."id")))
     LEFT JOIN "public"."user_notification_settings" "n" ON (("u"."id" = "n"."user_id")))
     LEFT JOIN "public"."user_appearance_settings" "a" ON (("u"."id" = "a"."user_id")))
     LEFT JOIN "public"."user_locale_settings" "l" ON (("u"."id" = "l"."user_id")))
     LEFT JOIN "public"."user_privacy_settings" "pr" ON (("u"."id" = "pr"."user_id")))
     LEFT JOIN "public"."user_document_preferences" "dp" ON (("u"."id" = "dp"."user_id")));


ALTER VIEW "public"."user_settings_complete" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(500) NOT NULL,
    "description" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "priority" character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    "due_date" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "category" character varying(50) DEFAULT 'general'::character varying,
    "document_id" "uuid",
    "calendar_event_id" "uuid",
    "related_url" "text",
    "reminder_date" timestamp with time zone,
    "reminder_sent" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_tasks_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['interpellation'::character varying, 'commission'::character varying, 'session'::character varying, 'citizen'::character varying, 'budget'::character varying, 'legal'::character varying, 'general'::character varying])::"text"[]))),
    CONSTRAINT "user_tasks_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::"text"[]))),
    CONSTRAINT "user_tasks_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_tasks" IS 'Lista zadań (TODO) radnego z priorytetami i terminami';



CREATE TABLE IF NOT EXISTS "public"."user_voice_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wake_word" character varying(50) DEFAULT 'Asystencie'::character varying,
    "continuous_mode" boolean DEFAULT false,
    "auto_tts" boolean DEFAULT true,
    "tts_voice" character varying(50) DEFAULT 'pl-PL-MarekNeural'::character varying,
    "tts_speed" double precision DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_voice_settings_tts_speed_check" CHECK ((("tts_speed" >= (0.5)::double precision) AND ("tts_speed" <= (2.0)::double precision)))
);


ALTER TABLE "public"."user_voice_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_voice_settings" IS 'Ustawienia obsługi głosowej (wake word, TTS, itp.)';



CREATE TABLE IF NOT EXISTS "public"."voice_commands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transcription" "text" NOT NULL,
    "intent" "text",
    "confidence" double precision DEFAULT 0,
    "action" "jsonb",
    "executed" boolean DEFAULT false,
    "execution_result" "jsonb",
    "audio_duration_ms" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "voice_commands_intent_check" CHECK (("intent" = ANY (ARRAY['navigation'::"text", 'search'::"text", 'chat'::"text", 'control'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."voice_commands" OWNER TO "postgres";


COMMENT ON TABLE "public"."voice_commands" IS 'Historia komend głosowych użytkowników';



CREATE TABLE IF NOT EXISTS "public"."voice_macros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trigger_phrase" "text" NOT NULL,
    "description" "text",
    "actions" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "usage_count" integer DEFAULT 0,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voice_macros" OWNER TO "postgres";


COMMENT ON TABLE "public"."voice_macros" IS 'Niestandardowe makra głosowe zdefiniowane przez użytkowników';



ALTER TABLE ONLY "public"."api_configurations"
    ADD CONSTRAINT "api_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_configurations"
    ADD CONSTRAINT "api_configurations_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."api_test_history"
    ADD CONSTRAINT "api_test_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."background_tasks"
    ADD CONSTRAINT "background_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_sources"
    ADD CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_cluster_members"
    ADD CONSTRAINT "document_cluster_members_cluster_id_document_id_key" UNIQUE ("cluster_id", "document_id");



ALTER TABLE ONLY "public"."document_cluster_members"
    ADD CONSTRAINT "document_cluster_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_clusters"
    ADD CONSTRAINT "document_clusters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_jobs"
    ADD CONSTRAINT "document_jobs_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."document_jobs"
    ADD CONSTRAINT "document_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_relations"
    ADD CONSTRAINT "document_relations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_relations"
    ADD CONSTRAINT "document_relations_source_document_id_target_document_id_re_key" UNIQUE ("source_document_id", "target_document_id", "relation_type");



ALTER TABLE ONLY "public"."epuap_messages"
    ADD CONSTRAINT "epuap_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gis_notification_logs"
    ADD CONSTRAINT "gis_notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gis_notification_settings"
    ADD CONSTRAINT "gis_notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gis_notification_settings"
    ADD CONSTRAINT "gis_notification_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."gis_notifications"
    ADD CONSTRAINT "gis_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."municipal_data"
    ADD CONSTRAINT "municipal_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."processed_documents"
    ADD CONSTRAINT "processed_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_capabilities"
    ADD CONSTRAINT "provider_capabilities_pkey" PRIMARY KEY ("provider");



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."research_reports"
    ADD CONSTRAINT "research_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scraped_content"
    ADD CONSTRAINT "scraped_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scraped_content"
    ADD CONSTRAINT "scraped_content_source_id_url_key" UNIQUE ("source_id", "url");



ALTER TABLE ONLY "public"."scraping_logs"
    ADD CONSTRAINT "scraping_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transcription_jobs"
    ADD CONSTRAINT "transcription_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ai_settings"
    ADD CONSTRAINT "user_ai_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ai_settings"
    ADD CONSTRAINT "user_ai_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_alerts"
    ADD CONSTRAINT "user_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_appearance_settings"
    ADD CONSTRAINT "user_appearance_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_appearance_settings"
    ADD CONSTRAINT "user_appearance_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_calendar_events"
    ADD CONSTRAINT "user_calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_document_preferences"
    ADD CONSTRAINT "user_document_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_document_preferences"
    ADD CONSTRAINT "user_document_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_user_id_integration_type_key" UNIQUE ("user_id", "integration_type");



ALTER TABLE ONLY "public"."user_locale_settings"
    ADD CONSTRAINT "user_locale_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_locale_settings"
    ADD CONSTRAINT "user_locale_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_privacy_settings"
    ADD CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_privacy_settings"
    ADD CONSTRAINT "user_privacy_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tasks"
    ADD CONSTRAINT "user_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_voice_settings"
    ADD CONSTRAINT "user_voice_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_voice_settings"
    ADD CONSTRAINT "user_voice_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."voice_commands"
    ADD CONSTRAINT "voice_commands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_macros"
    ADD CONSTRAINT "voice_macros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_macros"
    ADD CONSTRAINT "voice_macros_trigger_unique" UNIQUE ("user_id", "trigger_phrase");



CREATE INDEX "idx_alerts_type" ON "public"."user_alerts" USING "btree" ("alert_type");



CREATE INDEX "idx_alerts_unread" ON "public"."user_alerts" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_alerts_user" ON "public"."user_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_api_configurations_active" ON "public"."api_configurations" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_api_configurations_default" ON "public"."api_configurations" USING "btree" ("user_id", "is_default");



CREATE INDEX "idx_api_configurations_last_test" ON "public"."api_configurations" USING "btree" ("user_id", "last_test_at" DESC);



CREATE INDEX "idx_api_configurations_provider" ON "public"."api_configurations" USING "btree" ("user_id", "provider");



CREATE INDEX "idx_api_configurations_status" ON "public"."api_configurations" USING "btree" ("user_id", "connection_status");



CREATE INDEX "idx_api_configurations_type" ON "public"."api_configurations" USING "btree" ("config_type");



CREATE INDEX "idx_api_configurations_user" ON "public"."api_configurations" USING "btree" ("user_id");



CREATE INDEX "idx_appearance_settings_user" ON "public"."user_appearance_settings" USING "btree" ("user_id");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_background_tasks_created_at" ON "public"."background_tasks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_background_tasks_status" ON "public"."background_tasks" USING "btree" ("status");



CREATE INDEX "idx_background_tasks_user_id" ON "public"."background_tasks" USING "btree" ("user_id");



CREATE INDEX "idx_background_tasks_user_status" ON "public"."background_tasks" USING "btree" ("user_id", "status");



CREATE INDEX "idx_calendar_events_date" ON "public"."user_calendar_events" USING "btree" ("start_date");



CREATE INDEX "idx_calendar_events_google_id" ON "public"."calendar_events" USING "btree" ("google_event_id");



CREATE INDEX "idx_calendar_events_start_time" ON "public"."calendar_events" USING "btree" ("start_time");



CREATE INDEX "idx_calendar_events_type" ON "public"."user_calendar_events" USING "btree" ("event_type");



CREATE INDEX "idx_calendar_events_user" ON "public"."user_calendar_events" USING "btree" ("user_id");



CREATE INDEX "idx_calendar_events_user_id" ON "public"."calendar_events" USING "btree" ("user_id");



CREATE INDEX "idx_cluster_members_cluster" ON "public"."document_cluster_members" USING "btree" ("cluster_id");



CREATE INDEX "idx_cluster_members_document" ON "public"."document_cluster_members" USING "btree" ("document_id");



CREATE INDEX "idx_conversations_created_at" ON "public"."conversations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_data_sources_category" ON "public"."data_sources" USING "btree" ("category");



CREATE INDEX "idx_data_sources_category_funding" ON "public"."data_sources" USING "btree" ("user_id", "category") WHERE (("category" = 'statistical'::"text") AND ("type" = 'funding'::"text"));



CREATE INDEX "idx_data_sources_ceidg" ON "public"."data_sources" USING "btree" ("user_id") WHERE ("url" = 'https://dane.biznes.gov.pl'::"text");



CREATE INDEX "idx_data_sources_eu_funds" ON "public"."data_sources" USING "btree" ("user_id") WHERE ("url" = 'https://www.funduszeeuropejskie.gov.pl'::"text");



CREATE INDEX "idx_data_sources_fetch_method" ON "public"."data_sources" USING "btree" ("fetch_method");



CREATE INDEX "idx_data_sources_gdos" ON "public"."data_sources" USING "btree" ("user_id") WHERE ("url" = 'https://sdi.gdos.gov.pl'::"text");



CREATE INDEX "idx_data_sources_geoportal" ON "public"."data_sources" USING "btree" ("user_id") WHERE ("url" = 'https://geoportal.gov.pl'::"text");



CREATE INDEX "idx_data_sources_isap" ON "public"."data_sources" USING "btree" ("user_id") WHERE ("url" = 'https://isap.sejm.gov.pl'::"text");



CREATE INDEX "idx_data_sources_krs" ON "public"."data_sources" USING "btree" ("user_id") WHERE ("url" = 'https://api-krs.ms.gov.pl'::"text");



CREATE INDEX "idx_data_sources_legal_scope" ON "public"."data_sources" USING "gin" ("legal_scope");



CREATE INDEX "idx_data_sources_next_scrape" ON "public"."data_sources" USING "btree" ("next_scrape_at") WHERE ("scraping_enabled" = true);



CREATE INDEX "idx_data_sources_priority" ON "public"."data_sources" USING "btree" ("priority");



CREATE INDEX "idx_data_sources_tags" ON "public"."data_sources" USING "gin" ("tags");



CREATE INDEX "idx_data_sources_teryt" ON "public"."data_sources" USING "btree" ("user_id") WHERE ("url" = 'https://api-teryt.stat.gov.pl'::"text");



CREATE INDEX "idx_data_sources_type" ON "public"."data_sources" USING "btree" ("type");



CREATE INDEX "idx_data_sources_user_id" ON "public"."data_sources" USING "btree" ("user_id");



CREATE INDEX "idx_doc_relations_bidirectional" ON "public"."document_relations" USING "btree" ("source_document_id", "target_document_id");



CREATE INDEX "idx_doc_relations_source" ON "public"."document_relations" USING "btree" ("source_document_id");



CREATE INDEX "idx_doc_relations_strength" ON "public"."document_relations" USING "btree" ("strength" DESC);



CREATE INDEX "idx_doc_relations_target" ON "public"."document_relations" USING "btree" ("target_document_id");



CREATE INDEX "idx_doc_relations_type" ON "public"."document_relations" USING "btree" ("relation_type");



CREATE INDEX "idx_document_jobs_created_at" ON "public"."document_jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_document_jobs_status" ON "public"."document_jobs" USING "btree" ("status");



CREATE INDEX "idx_document_jobs_user_id" ON "public"."document_jobs" USING "btree" ("user_id");



CREATE INDEX "idx_document_preferences_user" ON "public"."user_document_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_epuap_messages_epuap_id" ON "public"."epuap_messages" USING "btree" ("epuap_message_id");



CREATE INDEX "idx_epuap_messages_received_at" ON "public"."epuap_messages" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_epuap_messages_status" ON "public"."epuap_messages" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_epuap_messages_unique" ON "public"."epuap_messages" USING "btree" ("user_id", "epuap_message_id");



CREATE INDEX "idx_epuap_messages_user_id" ON "public"."epuap_messages" USING "btree" ("user_id");



CREATE INDEX "idx_generated_reports_generated_at" ON "public"."generated_reports" USING "btree" ("generated_at" DESC);



CREATE INDEX "idx_generated_reports_schedule_id" ON "public"."generated_reports" USING "btree" ("schedule_id");



CREATE INDEX "idx_generated_reports_user_id" ON "public"."generated_reports" USING "btree" ("user_id");



CREATE INDEX "idx_gis_notification_logs_notification_id" ON "public"."gis_notification_logs" USING "btree" ("notification_id");



CREATE INDEX "idx_gis_notification_logs_sent_at" ON "public"."gis_notification_logs" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_gis_notification_logs_user_id" ON "public"."gis_notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_gis_notification_settings_user_id" ON "public"."gis_notification_settings" USING "btree" ("user_id");



CREATE INDEX "idx_gis_notifications_created_at" ON "public"."gis_notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_gis_notifications_read_at" ON "public"."gis_notifications" USING "btree" ("read_at");



CREATE INDEX "idx_gis_notifications_source_id" ON "public"."gis_notifications" USING "btree" ("source_id");



CREATE INDEX "idx_gis_notifications_unread" ON "public"."gis_notifications" USING "btree" ("user_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_gis_notifications_user_id" ON "public"."gis_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_locale_settings_user" ON "public"."user_locale_settings" USING "btree" ("user_id");



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_municipal_data_embedding" ON "public"."municipal_data" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_municipal_data_meeting_date" ON "public"."municipal_data" USING "btree" ("meeting_date");



CREATE INDEX "idx_municipal_data_type" ON "public"."municipal_data" USING "btree" ("data_type");



CREATE INDEX "idx_municipal_data_user_id" ON "public"."municipal_data" USING "btree" ("user_id");



CREATE INDEX "idx_notification_settings_user" ON "public"."user_notification_settings" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("user_id", "read") WHERE ("read" = false);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_password_reset_tokens_expires_at" ON "public"."password_reset_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_password_reset_tokens_token" ON "public"."password_reset_tokens" USING "btree" ("token");



CREATE INDEX "idx_password_reset_tokens_user_id" ON "public"."password_reset_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_privacy_settings_user" ON "public"."user_privacy_settings" USING "btree" ("user_id");



CREATE INDEX "idx_processed_docs_content_search" ON "public"."processed_documents" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("content", ''::"text")));



CREATE INDEX "idx_processed_docs_normalized_date" ON "public"."processed_documents" USING "btree" ("user_id", "normalized_publish_date" DESC NULLS LAST);



CREATE INDEX "idx_processed_docs_normalized_title" ON "public"."processed_documents" USING "btree" ("user_id", "lower"(("normalized_title")::"text")) WHERE ("normalized_title" IS NOT NULL);



CREATE INDEX "idx_processed_docs_search_combo" ON "public"."processed_documents" USING "btree" ("user_id", "document_type", "normalized_publish_date" DESC NULLS LAST, "session_number");



CREATE INDEX "idx_processed_docs_session_number" ON "public"."processed_documents" USING "btree" ("user_id", "session_number") WHERE ("session_number" IS NOT NULL);



CREATE INDEX "idx_processed_docs_title_search" ON "public"."processed_documents" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("title", ''::"text")));



CREATE INDEX "idx_processed_docs_user_type" ON "public"."processed_documents" USING "btree" ("user_id", "document_type");



CREATE INDEX "idx_processed_documents_embedding" ON "public"."processed_documents" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_processed_documents_fts" ON "public"."processed_documents" USING "gin" ("to_tsvector"('"simple"'::"regconfig", ((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("content", ''::"text"))));



CREATE INDEX "idx_processed_documents_publish_date" ON "public"."processed_documents" USING "btree" ("publish_date" DESC);



CREATE INDEX "idx_processed_documents_title_lookup" ON "public"."processed_documents" USING "btree" ("user_id", "document_type", "lower"("title"));



CREATE INDEX "idx_processed_documents_type" ON "public"."processed_documents" USING "btree" ("document_type");



CREATE UNIQUE INDEX "idx_processed_documents_unique_source_url" ON "public"."processed_documents" USING "btree" ("user_id", "source_url") WHERE ("source_url" IS NOT NULL);



CREATE INDEX "idx_processed_documents_user_id" ON "public"."processed_documents" USING "btree" ("user_id");



CREATE INDEX "idx_provider_capabilities_chat" ON "public"."provider_capabilities" USING "btree" ("supports_chat") WHERE ("supports_chat" = true);



CREATE INDEX "idx_provider_capabilities_embeddings" ON "public"."provider_capabilities" USING "btree" ("supports_embeddings") WHERE ("supports_embeddings" = true);



CREATE INDEX "idx_report_schedules_enabled" ON "public"."report_schedules" USING "btree" ("enabled");



CREATE INDEX "idx_report_schedules_next_run" ON "public"."report_schedules" USING "btree" ("next_run_at") WHERE ("enabled" = true);



CREATE INDEX "idx_report_schedules_user_id" ON "public"."report_schedules" USING "btree" ("user_id");



CREATE INDEX "idx_research_reports_confidence" ON "public"."research_reports" USING "btree" ("confidence" DESC);



CREATE INDEX "idx_research_reports_created_at" ON "public"."research_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_research_reports_research_type" ON "public"."research_reports" USING "btree" ("research_type");



CREATE INDEX "idx_research_reports_user_id" ON "public"."research_reports" USING "btree" ("user_id");



CREATE INDEX "idx_scraped_content_hash" ON "public"."scraped_content" USING "btree" ("content_hash");



CREATE INDEX "idx_scraped_content_pdf_links" ON "public"."scraped_content" USING "gin" ("pdf_links");



CREATE INDEX "idx_scraped_content_scraped_at" ON "public"."scraped_content" USING "btree" ("scraped_at" DESC);



CREATE INDEX "idx_scraped_content_source_id" ON "public"."scraped_content" USING "btree" ("source_id");



CREATE INDEX "idx_scraping_logs_created_at" ON "public"."scraping_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_scraping_logs_source_id" ON "public"."scraping_logs" USING "btree" ("source_id");



CREATE INDEX "idx_scraping_logs_status" ON "public"."scraping_logs" USING "btree" ("status");



CREATE INDEX "idx_tasks_due_date" ON "public"."user_tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_priority" ON "public"."user_tasks" USING "btree" ("priority");



CREATE INDEX "idx_tasks_status" ON "public"."user_tasks" USING "btree" ("status");



CREATE INDEX "idx_tasks_user" ON "public"."user_tasks" USING "btree" ("user_id");



CREATE INDEX "idx_test_history_config" ON "public"."api_test_history" USING "btree" ("config_id", "tested_at" DESC);



CREATE INDEX "idx_test_history_status" ON "public"."api_test_history" USING "btree" ("config_id", "status");



CREATE INDEX "idx_test_history_tested_at" ON "public"."api_test_history" USING "btree" ("tested_at" DESC);



CREATE INDEX "idx_user_ai_settings_user_id" ON "public"."user_ai_settings" USING "btree" ("user_id");



CREATE INDEX "idx_user_integrations_user_type" ON "public"."user_integrations" USING "btree" ("user_id", "integration_type");



CREATE INDEX "idx_user_profiles_full_name" ON "public"."user_profiles" USING "btree" ("full_name");



CREATE INDEX "idx_voice_commands_created_at" ON "public"."voice_commands" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_voice_commands_executed" ON "public"."voice_commands" USING "btree" ("executed");



CREATE INDEX "idx_voice_commands_intent" ON "public"."voice_commands" USING "btree" ("intent");



CREATE INDEX "idx_voice_commands_user_id" ON "public"."voice_commands" USING "btree" ("user_id");



CREATE INDEX "idx_voice_macros_is_active" ON "public"."voice_macros" USING "btree" ("is_active");



CREATE INDEX "idx_voice_macros_trigger_phrase" ON "public"."voice_macros" USING "btree" ("trigger_phrase");



CREATE INDEX "idx_voice_macros_user_id" ON "public"."voice_macros" USING "btree" ("user_id");



CREATE INDEX "idx_voice_settings_user" ON "public"."user_voice_settings" USING "btree" ("user_id");



CREATE INDEX "transcription_jobs_status_idx" ON "public"."transcription_jobs" USING "btree" ("status");



CREATE INDEX "transcription_jobs_user_id_idx" ON "public"."transcription_jobs" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_processed_documents_user_url" ON "public"."processed_documents" USING "btree" ("user_id", "source_url");



CREATE OR REPLACE TRIGGER "detect_references_on_document" AFTER INSERT OR UPDATE OF "content" ON "public"."processed_documents" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_detect_references"();



CREATE OR REPLACE TRIGGER "ensure_single_default_api_config_trigger" BEFORE INSERT OR UPDATE ON "public"."api_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_default_api_config"();



CREATE OR REPLACE TRIGGER "notify_new_document" AFTER INSERT ON "public"."processed_documents" FOR EACH ROW EXECUTE FUNCTION "public"."create_document_notification"();



CREATE OR REPLACE TRIGGER "set_next_scrape_time" BEFORE INSERT OR UPDATE OF "scraping_frequency", "scraping_enabled", "last_scraped_at" ON "public"."data_sources" FOR EACH ROW EXECUTE FUNCTION "public"."update_next_scrape_time"();



CREATE OR REPLACE TRIGGER "trg_normalize_source_url" BEFORE INSERT OR UPDATE ON "public"."processed_documents" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_source_url"();



CREATE OR REPLACE TRIGGER "trigger_background_tasks_updated_at" BEFORE UPDATE ON "public"."background_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_background_tasks_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_cleanup_test_history" AFTER INSERT ON "public"."api_test_history" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_old_test_history"();



CREATE OR REPLACE TRIGGER "trigger_epuap_messages_updated_at" BEFORE UPDATE ON "public"."epuap_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_epuap_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_voice_macro_timestamp" BEFORE UPDATE ON "public"."voice_macros" FOR EACH ROW EXECUTE FUNCTION "public"."update_voice_macro_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_user_ai_settings_updated_at" BEFORE UPDATE ON "public"."user_ai_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_ai_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_user_integrations_updated_at" BEFORE UPDATE ON "public"."user_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_epuap_updated_at"();



CREATE OR REPLACE TRIGGER "update_api_configurations_updated_at" BEFORE UPDATE ON "public"."api_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_appearance_settings_updated_at" BEFORE UPDATE ON "public"."user_appearance_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_calendar_events_updated_at" BEFORE UPDATE ON "public"."user_calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_conversation_on_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_timestamp"();



CREATE OR REPLACE TRIGGER "update_document_preferences_updated_at" BEFORE UPDATE ON "public"."user_document_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_locale_settings_updated_at" BEFORE UPDATE ON "public"."user_locale_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_settings_updated_at" BEFORE UPDATE ON "public"."user_notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_privacy_settings_updated_at" BEFORE UPDATE ON "public"."user_privacy_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."user_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_voice_settings_updated_at" BEFORE UPDATE ON "public"."user_voice_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_data_source_config" BEFORE INSERT OR UPDATE ON "public"."data_sources" FOR EACH ROW EXECUTE FUNCTION "public"."validate_api_config"();



ALTER TABLE ONLY "public"."api_configurations"
    ADD CONSTRAINT "api_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_test_history"
    ADD CONSTRAINT "api_test_history_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."api_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."background_tasks"
    ADD CONSTRAINT "background_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_sources"
    ADD CONSTRAINT "data_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_cluster_members"
    ADD CONSTRAINT "document_cluster_members_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "public"."document_clusters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_cluster_members"
    ADD CONSTRAINT "document_cluster_members_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."processed_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_cluster_members"
    ADD CONSTRAINT "document_cluster_members_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "public"."processed_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_clusters"
    ADD CONSTRAINT "document_clusters_root_document_id_fkey" FOREIGN KEY ("root_document_id") REFERENCES "public"."processed_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_jobs"
    ADD CONSTRAINT "document_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_relations"
    ADD CONSTRAINT "document_relations_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "public"."processed_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_relations"
    ADD CONSTRAINT "document_relations_target_document_id_fkey" FOREIGN KEY ("target_document_id") REFERENCES "public"."processed_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."epuap_messages"
    ADD CONSTRAINT "epuap_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."report_schedules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gis_notification_logs"
    ADD CONSTRAINT "gis_notification_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."gis_notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gis_notification_logs"
    ADD CONSTRAINT "gis_notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gis_notification_settings"
    ADD CONSTRAINT "gis_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gis_notifications"
    ADD CONSTRAINT "gis_notifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."processed_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gis_notifications"
    ADD CONSTRAINT "gis_notifications_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gis_notifications"
    ADD CONSTRAINT "gis_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."municipal_data"
    ADD CONSTRAINT "municipal_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."processed_documents"
    ADD CONSTRAINT "processed_documents_scraped_content_id_fkey" FOREIGN KEY ("scraped_content_id") REFERENCES "public"."scraped_content"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."processed_documents"
    ADD CONSTRAINT "processed_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."research_reports"
    ADD CONSTRAINT "research_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scraped_content"
    ADD CONSTRAINT "scraped_content_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scraping_logs"
    ADD CONSTRAINT "scraping_logs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transcription_jobs"
    ADD CONSTRAINT "transcription_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ai_settings"
    ADD CONSTRAINT "user_ai_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_alerts"
    ADD CONSTRAINT "user_alerts_calendar_event_id_fkey" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."user_calendar_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_alerts"
    ADD CONSTRAINT "user_alerts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."processed_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_alerts"
    ADD CONSTRAINT "user_alerts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."user_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_alerts"
    ADD CONSTRAINT "user_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_appearance_settings"
    ADD CONSTRAINT "user_appearance_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_calendar_events"
    ADD CONSTRAINT "user_calendar_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."processed_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_calendar_events"
    ADD CONSTRAINT "user_calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_document_preferences"
    ADD CONSTRAINT "user_document_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_locale_settings"
    ADD CONSTRAINT "user_locale_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_privacy_settings"
    ADD CONSTRAINT "user_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tasks"
    ADD CONSTRAINT "user_tasks_calendar_event_id_fkey" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."user_calendar_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_tasks"
    ADD CONSTRAINT "user_tasks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."processed_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_tasks"
    ADD CONSTRAINT "user_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_voice_settings"
    ADD CONSTRAINT "user_voice_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_commands"
    ADD CONSTRAINT "voice_commands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_macros"
    ADD CONSTRAINT "voice_macros_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can read audit logs" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Service role can manage all tasks" ON "public"."background_tasks" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."document_jobs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "System can insert audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create messages in own conversations" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create own calendar events" ON "public"."calendar_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own conversations" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own data sources" ON "public"."data_sources" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own municipal data" ON "public"."municipal_data" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own processed documents" ON "public"."processed_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own research reports" ON "public"."research_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own calendar events" ON "public"."calendar_events" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own conversations" ON "public"."conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own data sources" ON "public"."data_sources" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own document jobs" ON "public"."document_jobs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own epuap messages" ON "public"."epuap_messages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own municipal data" ON "public"."municipal_data" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own notifications" ON "public"."gis_notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own processed documents" ON "public"."processed_documents" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own research reports" ON "public"."research_reports" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own voice commands" ON "public"."voice_commands" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own ai settings" ON "public"."user_ai_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own epuap messages" ON "public"."epuap_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own notification settings" ON "public"."gis_notification_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own voice commands" ON "public"."voice_commands" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own API configurations" ON "public"."api_configurations" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own alerts" ON "public"."user_alerts" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own appearance settings" ON "public"."user_appearance_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own calendar events" ON "public"."user_calendar_events" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own document preferences" ON "public"."user_document_preferences" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own generated reports" ON "public"."generated_reports" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own integrations" ON "public"."user_integrations" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own locale settings" ON "public"."user_locale_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own notification settings" ON "public"."user_notification_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own notifications" ON "public"."notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own privacy settings" ON "public"."user_privacy_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own report schedules" ON "public"."report_schedules" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own tasks" ON "public"."user_tasks" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own voice macros" ON "public"."voice_macros" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own voice settings" ON "public"."user_voice_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read cluster members" ON "public"."document_cluster_members" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read document clusters" ON "public"."document_clusters" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read document relations" ON "public"."document_relations" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own tokens" ON "public"."password_reset_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own ai settings" ON "public"."user_ai_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own calendar events" ON "public"."calendar_events" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own conversations" ON "public"."conversations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own data sources" ON "public"."data_sources" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own epuap messages" ON "public"."epuap_messages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own municipal data" ON "public"."municipal_data" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notification settings" ON "public"."gis_notification_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."gis_notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own processed documents" ON "public"."processed_documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile." ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own voice commands" ON "public"."voice_commands" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view logs from own sources" ON "public"."scraping_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."data_sources"
  WHERE (("data_sources"."id" = "scraping_logs"."source_id") AND ("data_sources"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view messages in own conversations" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own ai settings" ON "public"."user_ai_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own calendar events" ON "public"."calendar_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own data sources" ON "public"."data_sources" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own document jobs" ON "public"."document_jobs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own epuap messages" ON "public"."epuap_messages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own generated reports" ON "public"."generated_reports" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own integrations" ON "public"."user_integrations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own municipal data" ON "public"."municipal_data" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notification logs" ON "public"."gis_notification_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notification settings" ON "public"."gis_notification_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."gis_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own processed documents" ON "public"."processed_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile." ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own report schedules" ON "public"."report_schedules" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own research reports" ON "public"."research_reports" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own tasks" ON "public"."background_tasks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own voice commands" ON "public"."voice_commands" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view scraped content from own sources" ON "public"."scraped_content" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."data_sources"
  WHERE (("data_sources"."id" = "scraped_content"."source_id") AND ("data_sources"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."api_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_test_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."background_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_cluster_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_clusters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_relations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."epuap_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generated_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gis_notification_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gis_notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gis_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."municipal_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_capabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."research_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scraped_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scraping_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transcription_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_ai_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_appearance_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_document_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_locale_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_privacy_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_voice_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_commands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_macros" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_ceidg_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_ceidg_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_ceidg_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_eu_funds_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_eu_funds_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_eu_funds_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_gdos_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_gdos_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_gdos_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_geoportal_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_geoportal_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_geoportal_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_gus_bdl_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_gus_bdl_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_gus_bdl_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_isap_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_isap_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_isap_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_krs_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_krs_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_krs_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_teryt_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_teryt_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_teryt_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_next_scrape"("frequency" "text", "base_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_scrape"("frequency" "text", "base_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_scrape"("frequency" "text", "base_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_tokens"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_tokens"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_tokens"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_test_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_test_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_test_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_voice_commands"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_voice_commands"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_voice_commands"("p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_api_sources"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_api_sources"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_api_sources"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_data_sources"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_data_sources"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_data_sources"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_notification_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_notification_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_notification_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_document_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_document_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_document_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_document_references"("p_document_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_document_references"("p_document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_document_references"("p_document_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_api_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_api_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_api_config"() TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_session_number"("title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_session_number"("title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_session_number"("title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_document_path"("p_source_id" "uuid", "p_target_id" "uuid", "p_max_depth" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_document_path"("p_source_id" "uuid", "p_target_id" "uuid", "p_max_depth" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_document_path"("p_source_id" "uuid", "p_target_id" "uuid", "p_max_depth" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_related_documents"("p_document_id" "uuid", "p_max_depth" integer, "p_min_strength" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_related_documents"("p_document_id" "uuid", "p_max_depth" integer, "p_min_strength" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_related_documents"("p_document_id" "uuid", "p_max_depth" integer, "p_min_strength" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_notifications"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_notifications"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_notifications"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_voice_command_stats"("p_user_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_voice_command_stats"("p_user_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_voice_command_stats"("p_user_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "semantic_weight" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "semantic_weight" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "semantic_weight" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_user_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_user_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_user_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_user_action"("p_user_id" "uuid", "p_action" "text", "p_details" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_user_action"("p_user_id" "uuid", "p_action" "text", "p_details" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_user_action"("p_user_id" "uuid", "p_action" "text", "p_details" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notifications_as_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notifications_as_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notifications_as_read"("p_user_id" "uuid", "p_notification_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents_filtered"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_document_types" "text"[], "filter_date_from" "date", "filter_date_to" "date", "filter_keywords" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents_filtered"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_document_types" "text"[], "filter_date_from" "date", "filter_date_to" "date", "filter_keywords" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents_filtered"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_document_types" "text"[], "filter_date_from" "date", "filter_date_to" "date", "filter_keywords" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_document_title"("title" "text", "session_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_document_title"("title" "text", "session_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_document_title"("title" "text", "session_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_source_url"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_source_url"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_source_url"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_municipal_data"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."search_municipal_data"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_municipal_data"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_processed_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_types" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."search_processed_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_types" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_processed_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_user_id" "uuid", "filter_types" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_voice_macros"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_voice_macros"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_voice_macros"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_detect_references"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_detect_references"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_detect_references"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_background_tasks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_background_tasks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_background_tasks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_epuap_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_epuap_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_epuap_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_next_scrape_time"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_next_scrape_time"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_next_scrape_time"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_ai_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_ai_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_ai_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_voice_macro_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_voice_macro_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_voice_macro_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_api_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_api_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_api_config"() TO "service_role";



GRANT ALL ON TABLE "public"."api_configurations" TO "anon";
GRANT ALL ON TABLE "public"."api_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."api_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."api_test_history" TO "anon";
GRANT ALL ON TABLE "public"."api_test_history" TO "authenticated";
GRANT ALL ON TABLE "public"."api_test_history" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."background_tasks" TO "anon";
GRANT ALL ON TABLE "public"."background_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."background_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."data_sources" TO "anon";
GRANT ALL ON TABLE "public"."data_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."data_sources" TO "service_role";



GRANT ALL ON TABLE "public"."document_cluster_members" TO "anon";
GRANT ALL ON TABLE "public"."document_cluster_members" TO "authenticated";
GRANT ALL ON TABLE "public"."document_cluster_members" TO "service_role";



GRANT ALL ON TABLE "public"."document_clusters" TO "anon";
GRANT ALL ON TABLE "public"."document_clusters" TO "authenticated";
GRANT ALL ON TABLE "public"."document_clusters" TO "service_role";



GRANT ALL ON TABLE "public"."document_relations" TO "anon";
GRANT ALL ON TABLE "public"."document_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."document_relations" TO "service_role";



GRANT ALL ON TABLE "public"."processed_documents" TO "anon";
GRANT ALL ON TABLE "public"."processed_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_documents" TO "service_role";



GRANT ALL ON TABLE "public"."document_graph_stats" TO "anon";
GRANT ALL ON TABLE "public"."document_graph_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."document_graph_stats" TO "service_role";



GRANT ALL ON TABLE "public"."document_jobs" TO "anon";
GRANT ALL ON TABLE "public"."document_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."document_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."epuap_messages" TO "anon";
GRANT ALL ON TABLE "public"."epuap_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."epuap_messages" TO "service_role";



GRANT ALL ON TABLE "public"."generated_reports" TO "anon";
GRANT ALL ON TABLE "public"."generated_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_reports" TO "service_role";



GRANT ALL ON TABLE "public"."gis_notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."gis_notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."gis_notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."gis_notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."gis_notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."gis_notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."gis_notifications" TO "anon";
GRANT ALL ON TABLE "public"."gis_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."gis_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."municipal_data" TO "anon";
GRANT ALL ON TABLE "public"."municipal_data" TO "authenticated";
GRANT ALL ON TABLE "public"."municipal_data" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."provider_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."provider_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."report_schedules" TO "anon";
GRANT ALL ON TABLE "public"."report_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."report_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."research_reports" TO "anon";
GRANT ALL ON TABLE "public"."research_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."research_reports" TO "service_role";



GRANT ALL ON TABLE "public"."scraped_content" TO "anon";
GRANT ALL ON TABLE "public"."scraped_content" TO "authenticated";
GRANT ALL ON TABLE "public"."scraped_content" TO "service_role";



GRANT ALL ON TABLE "public"."scraping_logs" TO "anon";
GRANT ALL ON TABLE "public"."scraping_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."scraping_logs" TO "service_role";



GRANT ALL ON TABLE "public"."transcription_jobs" TO "anon";
GRANT ALL ON TABLE "public"."transcription_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."transcription_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."upcoming_sessions" TO "anon";
GRANT ALL ON TABLE "public"."upcoming_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."upcoming_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_ai_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_ai_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ai_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_alerts" TO "anon";
GRANT ALL ON TABLE "public"."user_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."user_appearance_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_appearance_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_appearance_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."user_calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_document_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_document_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_document_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_integrations" TO "anon";
GRANT ALL ON TABLE "public"."user_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."user_locale_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_locale_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_locale_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_privacy_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_privacy_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_privacy_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings_complete" TO "anon";
GRANT ALL ON TABLE "public"."user_settings_complete" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings_complete" TO "service_role";



GRANT ALL ON TABLE "public"."user_tasks" TO "anon";
GRANT ALL ON TABLE "public"."user_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_voice_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_voice_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_voice_settings" TO "service_role";



GRANT ALL ON TABLE "public"."voice_commands" TO "anon";
GRANT ALL ON TABLE "public"."voice_commands" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_commands" TO "service_role";



GRANT ALL ON TABLE "public"."voice_macros" TO "anon";
GRANT ALL ON TABLE "public"."voice_macros" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_macros" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







