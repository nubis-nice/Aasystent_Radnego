-- Dodanie GUS jako źródła danych
INSERT INTO data_sources (
  user_id, 
  name, 
  url, 
  type, 
  scraping_enabled, 
  fetch_method, 
  category,
  api_config
) VALUES (
  '2a35546a-7b24-4631-882c-056e38129d92', 
  'GUS - Bank Danych Lokalnych', 
  'https://bdl.stat.gov.pl/api/v1', 
  'statistics', 
  false, 
  'api', 
  'statistical',
  '{"provider": "gus", "endpoint": "/data/by-unit", "authType": "api-key"}'::jsonb
) ON CONFLICT DO NOTHING 
RETURNING id, name;
