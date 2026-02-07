-- Migracja: Schemat raportów cyklicznych
-- Data: 2026-01-25
-- Opis: Tabele dla harmonogramów raportów i wygenerowanych raportów

-- Tabela harmonogramów raportów
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('documents', 'sessions', 'budget', 'activity', 'custom')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  time_of_day TEXT NOT NULL, -- Format HH:MM
  enabled BOOLEAN DEFAULT true,
  email_notification BOOLEAN DEFAULT true,
  in_app_notification BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_report_schedules_user_id ON report_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled ON report_schedules(enabled);

-- Tabela wygenerowanych raportów
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_generated_reports_user_id ON generated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_schedule_id ON generated_reports(schedule_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_at ON generated_reports(generated_at DESC);

-- Tabela powiadomień (generyczna)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS dla report_schedules
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own report schedules"
  ON report_schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own report schedules"
  ON report_schedules FOR ALL
  USING (auth.uid() = user_id);

-- RLS dla generated_reports
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated reports"
  ON generated_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own generated reports"
  ON generated_reports FOR ALL
  USING (auth.uid() = user_id);

-- RLS dla notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id);

-- Komentarze
COMMENT ON TABLE report_schedules IS 'Harmonogramy raportów cyklicznych';
COMMENT ON TABLE generated_reports IS 'Wygenerowane raporty';
COMMENT ON TABLE notifications IS 'Powiadomienia in-app dla użytkowników';
