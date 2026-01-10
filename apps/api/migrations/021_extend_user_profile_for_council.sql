-- ============================================
-- Migracja: Rozszerzenie profilu użytkownika dla radnych
-- Data: 2026-01-10
-- Opis: Dodanie pól dla komisji, gminy, kadencji i roli w radzie
-- ============================================

-- 1. Rozszerzenie tabeli user_profiles o dane radnego
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role_in_council VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS committees TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS council_term VARCHAR(20) DEFAULT NULL;

COMMENT ON COLUMN user_profiles.role_in_council IS 'Rola w radzie: radny, przewodniczący, wiceprzewodniczący, etc.';
COMMENT ON COLUMN user_profiles.committees IS 'Lista komisji do których należy radny';
COMMENT ON COLUMN user_profiles.council_term IS 'Kadencja rady, np. 2024-2029';

-- 2. Rozszerzenie tabeli user_locale_settings o dane lokalne
ALTER TABLE user_locale_settings
ADD COLUMN IF NOT EXISTS municipality VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voivodeship VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bip_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS council_name VARCHAR(200) DEFAULT NULL;

COMMENT ON COLUMN user_locale_settings.municipality IS 'Gmina/Miasto użytkownika';
COMMENT ON COLUMN user_locale_settings.voivodeship IS 'Województwo';
COMMENT ON COLUMN user_locale_settings.bip_url IS 'URL do BIP gminy/miasta';
COMMENT ON COLUMN user_locale_settings.council_name IS 'Pełna nazwa rady, np. Rada Miejska w Białobrzegach';

-- 3. Tabela preferencji dokumentów
CREATE TABLE IF NOT EXISTS user_document_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Domyślne sortowanie
  default_sort_by VARCHAR(30) DEFAULT 'chronological' 
    CHECK (default_sort_by IN ('chronological', 'priority', 'type', 'relevance')),
  default_sort_order VARCHAR(10) DEFAULT 'desc' 
    CHECK (default_sort_order IN ('asc', 'desc')),
  
  -- Domyślne filtry
  default_document_types TEXT[] DEFAULT '{}',
  show_only_my_committees BOOLEAN DEFAULT false,
  
  -- Grupowanie
  group_by_session BOOLEAN DEFAULT true,
  show_related_documents BOOLEAN DEFAULT true,
  
  -- Widok
  default_view VARCHAR(20) DEFAULT 'list' 
    CHECK (default_view IN ('list', 'grid', 'timeline')),
  items_per_page INTEGER DEFAULT 20,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_preferences_user ON user_document_preferences(user_id);

ALTER TABLE user_document_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own document preferences" ON user_document_preferences;
CREATE POLICY "Users can manage own document preferences" 
  ON user_document_preferences FOR ALL USING (auth.uid() = user_id);

-- 4. Trigger dla updated_at
DROP TRIGGER IF EXISTS update_document_preferences_updated_at ON user_document_preferences;
CREATE TRIGGER update_document_preferences_updated_at 
  BEFORE UPDATE ON user_document_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Inicjalizacja preferencji dla istniejących użytkowników
INSERT INTO user_document_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 6. Aktualizacja funkcji inicjalizacji dla nowych użytkowników
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Aktualizacja widoku zbiorczego
DROP VIEW IF EXISTS user_settings_complete;
CREATE VIEW user_settings_complete AS
SELECT 
  u.id as user_id, 
  u.email,
  p.full_name, 
  p.phone, 
  p.position, 
  p.department, 
  p.avatar_url, 
  p.bio,
  p.role_in_council,
  p.committees,
  p.council_term,
  n.email_new_document, 
  n.email_analysis_complete, 
  n.email_weekly_report,
  n.push_new_document, 
  n.push_analysis_complete, 
  n.push_chat_mention,
  a.theme, 
  a.font_size, 
  a.compact_mode, 
  a.sidebar_collapsed,
  l.language, 
  l.timezone, 
  l.date_format, 
  l.time_format,
  l.municipality,
  l.voivodeship,
  l.bip_url,
  l.council_name,
  pr.profile_visibility, 
  pr.activity_tracking, 
  pr.analytics_consent, 
  pr.auto_delete_chats_after_days,
  dp.default_sort_by,
  dp.default_sort_order,
  dp.default_document_types,
  dp.show_only_my_committees,
  dp.group_by_session,
  dp.show_related_documents,
  dp.default_view,
  dp.items_per_page
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
LEFT JOIN user_notification_settings n ON u.id = n.user_id
LEFT JOIN user_appearance_settings a ON u.id = a.user_id
LEFT JOIN user_locale_settings l ON u.id = l.user_id
LEFT JOIN user_privacy_settings pr ON u.id = pr.user_id
LEFT JOIN user_document_preferences dp ON u.id = dp.user_id;

-- Koniec migracji
