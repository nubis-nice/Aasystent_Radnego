-- Migration: GIS (Global Information System) - Powiadomienia
-- Description: System globalnych powiadomień o nowościach z instytucji

-- Tabela powiadomień GIS
CREATE TABLE IF NOT EXISTS gis_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  document_id UUID REFERENCES processed_documents(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('new_document', 'update', 'alert', 'reminder', 'system')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gis_notifications_user_id ON gis_notifications(user_id);
CREATE INDEX idx_gis_notifications_source_id ON gis_notifications(source_id);
CREATE INDEX idx_gis_notifications_read_at ON gis_notifications(read_at);
CREATE INDEX idx_gis_notifications_created_at ON gis_notifications(created_at DESC);
CREATE INDEX idx_gis_notifications_unread ON gis_notifications(user_id, read_at) WHERE read_at IS NULL;

-- Ustawienia powiadomień użytkownika
CREATE TABLE IF NOT EXISTS gis_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Powiadomienia email
  email_enabled BOOLEAN DEFAULT true,
  email_frequency TEXT DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily_digest', 'weekly_digest', 'never')),
  email_types TEXT[] DEFAULT ARRAY['new_document', 'alert', 'urgent'],
  
  -- Powiadomienia push (w przyszłości)
  push_enabled BOOLEAN DEFAULT true,
  push_types TEXT[] DEFAULT ARRAY['alert', 'urgent'],
  
  -- Powiadomienia in-app
  inapp_enabled BOOLEAN DEFAULT true,
  
  -- Filtry źródeł
  enabled_source_types TEXT[] DEFAULT ARRAY['municipality', 'bip', 'hospital', 'emergency', 'environmental'],
  muted_sources UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Godziny ciszy (nie wysyłaj powiadomień)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gis_notification_settings_user_id ON gis_notification_settings(user_id);

-- Logi wysłanych powiadomień (dla audytu)
CREATE TABLE IF NOT EXISTS gis_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES gis_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'inapp', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'queued', 'skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gis_notification_logs_notification_id ON gis_notification_logs(notification_id);
CREATE INDEX idx_gis_notification_logs_user_id ON gis_notification_logs(user_id);
CREATE INDEX idx_gis_notification_logs_sent_at ON gis_notification_logs(sent_at DESC);

-- Funkcja do tworzenia powiadomienia o nowym dokumencie
CREATE OR REPLACE FUNCTION create_document_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger tworzący powiadomienie przy nowym dokumencie
CREATE TRIGGER notify_new_document
AFTER INSERT ON processed_documents
FOR EACH ROW
EXECUTE FUNCTION create_document_notification();

-- Funkcja do oznaczania powiadomień jako przeczytane
CREATE OR REPLACE FUNCTION mark_notifications_as_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql;

-- Funkcja do pobierania nieprzeczytanych powiadomień
CREATE OR REPLACE FUNCTION get_unread_notifications(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  source_name TEXT,
  notification_type TEXT,
  priority TEXT,
  title TEXT,
  message TEXT,
  action_url TEXT,
  created_at TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql;

-- Funkcja do czyszczenia starych powiadomień (starsze niż 90 dni)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM gis_notifications
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND (read_at IS NOT NULL OR dismissed_at IS NOT NULL);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies

-- GIS Notifications
ALTER TABLE gis_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON gis_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON gis_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON gis_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- GIS Notification Settings
ALTER TABLE gis_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification settings"
  ON gis_notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings"
  ON gis_notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings"
  ON gis_notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- GIS Notification Logs
ALTER TABLE gis_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification logs"
  ON gis_notification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Domyślne ustawienia powiadomień dla nowych użytkowników
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger tworzący domyślne ustawienia dla nowych użytkowników
DROP TRIGGER IF EXISTS create_user_notification_settings ON auth.users;
CREATE TRIGGER create_user_notification_settings
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_default_notification_settings();

COMMENT ON TABLE gis_notifications IS 'Powiadomienia GIS o nowościach z instytucji';
COMMENT ON TABLE gis_notification_settings IS 'Ustawienia powiadomień użytkownika';
COMMENT ON TABLE gis_notification_logs IS 'Logi wysłanych powiadomień';
