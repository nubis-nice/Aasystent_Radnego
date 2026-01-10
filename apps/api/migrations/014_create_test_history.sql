-- Migration: Create api_test_history table
-- Date: 2026-01-09
-- Description: Stores history of connection tests for API configurations

CREATE TABLE IF NOT EXISTS api_test_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES api_configurations(id) ON DELETE CASCADE,
  
  -- Test details
  test_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  
  -- Performance
  response_time_ms INTEGER,
  
  -- Error details
  error_message TEXT,
  error_details JSONB,
  
  -- Timestamp
  tested_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraints
ALTER TABLE api_test_history
  ADD CONSTRAINT check_test_type 
  CHECK (test_type IN ('connection', 'chat', 'embeddings', 'models', 'full'));

ALTER TABLE api_test_history
  ADD CONSTRAINT check_test_status 
  CHECK (status IN ('success', 'failed', 'timeout', 'error'));

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_test_history_config 
  ON api_test_history(config_id, tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_history_status 
  ON api_test_history(config_id, status);

CREATE INDEX IF NOT EXISTS idx_test_history_tested_at 
  ON api_test_history(tested_at DESC);

-- Add comments
COMMENT ON TABLE api_test_history IS 'History of connection tests for API configurations';
COMMENT ON COLUMN api_test_history.test_type IS 'Type of test: connection, chat, embeddings, models, full';
COMMENT ON COLUMN api_test_history.status IS 'Test result: success, failed, timeout, error';
COMMENT ON COLUMN api_test_history.response_time_ms IS 'Response time in milliseconds';
COMMENT ON COLUMN api_test_history.error_details IS 'JSON with detailed error information';

-- Function to clean old test history (keep last 10 per config)
CREATE OR REPLACE FUNCTION cleanup_old_test_history()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger to automatically cleanup old tests
DROP TRIGGER IF EXISTS trigger_cleanup_test_history ON api_test_history;

CREATE TRIGGER trigger_cleanup_test_history
  AFTER INSERT ON api_test_history
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_test_history();
