-- ============================================
-- Migracja: Pulpit radnego - Kalendarz i Zadania
-- Data: 2026-01-14
-- Opis: Tabele dla kalendarza-organizera i listy zadań radnego
-- ============================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. KALENDARZ - wydarzenia użytkownika
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Dane wydarzenia
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL DEFAULT 'other'
    CHECK (event_type IN ('session', 'committee', 'meeting', 'deadline', 'reminder', 'other')),
  
  -- Czas
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  
  -- Lokalizacja
  location VARCHAR(300),
  
  -- Powiązania
  document_id UUID REFERENCES processed_documents(id) ON DELETE SET NULL,
  source_url TEXT,
  
  -- Przypomnienia (minuty przed wydarzeniem)
  reminder_minutes INTEGER[] DEFAULT '{1440, 60}', -- 1 dzień, 1 godzina
  reminder_sent BOOLEAN DEFAULT false,
  
  -- Metadane
  color VARCHAR(20) DEFAULT 'primary',
  is_auto_imported BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON user_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON user_calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON user_calendar_events(event_type);

ALTER TABLE user_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own calendar events" ON user_calendar_events;
CREATE POLICY "Users can manage own calendar events" 
  ON user_calendar_events FOR ALL USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON user_calendar_events;
CREATE TRIGGER update_calendar_events_updated_at 
  BEFORE UPDATE ON user_calendar_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_calendar_events IS 'Kalendarz-organizer radnego z wydarzeniami';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ZADANIA - lista TODO radnego
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Treść zadania
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Status i priorytet
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  
  -- Termin
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Kategoria
  category VARCHAR(50) DEFAULT 'general'
    CHECK (category IN ('interpellation', 'commission', 'session', 'citizen', 'budget', 'legal', 'general')),
  
  -- Powiązania
  document_id UUID REFERENCES processed_documents(id) ON DELETE SET NULL,
  calendar_event_id UUID REFERENCES user_calendar_events(id) ON DELETE SET NULL,
  related_url TEXT,
  
  -- Przypomnienie
  reminder_date TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT false,
  
  -- Metadane
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON user_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON user_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON user_tasks(priority);

ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tasks" ON user_tasks;
CREATE POLICY "Users can manage own tasks" 
  ON user_tasks FOR ALL USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON user_tasks;
CREATE TRIGGER update_tasks_updated_at 
  BEFORE UPDATE ON user_tasks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_tasks IS 'Lista zadań (TODO) radnego z priorytetami i terminami';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. POWIADOMIENIA - alerty użytkownika
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Treść alertu
  title VARCHAR(300) NOT NULL,
  message TEXT,
  
  -- Typ i priorytet
  alert_type VARCHAR(30) NOT NULL DEFAULT 'info'
    CHECK (alert_type IN ('session', 'deadline', 'document', 'budget', 'interpellation', 'info', 'warning', 'error')),
  priority VARCHAR(20) DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT false,
  
  -- Powiązania
  document_id UUID REFERENCES processed_documents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES user_tasks(id) ON DELETE SET NULL,
  calendar_event_id UUID REFERENCES user_calendar_events(id) ON DELETE SET NULL,
  action_url TEXT,
  
  -- Czas ważności
  expires_at TIMESTAMPTZ,
  
  -- Metadane
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON user_alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_alerts_type ON user_alerts(alert_type);

ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own alerts" ON user_alerts;
CREATE POLICY "Users can manage own alerts" 
  ON user_alerts FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE user_alerts IS 'Powiadomienia i alerty dla radnego';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. WIDOK - Nadchodzące wydarzenia z dokumentów
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW upcoming_sessions AS
SELECT 
  id,
  user_id,
  title,
  document_type,
  session_number,
  normalized_publish_date as event_date,
  source_url,
  'session' as event_type
FROM processed_documents
WHERE 
  document_type IN ('session_agenda', 'session_protocol', 'committee_meeting')
  AND normalized_publish_date >= CURRENT_DATE
ORDER BY normalized_publish_date ASC;

COMMENT ON VIEW upcoming_sessions IS 'Nadchodzące sesje i posiedzenia komisji z dokumentów';

-- Koniec migracji
