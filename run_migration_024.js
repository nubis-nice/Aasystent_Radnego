const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://rgcegixkrigqxtiuuial.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnY2VnaXhrcmlncXh0aXV1aWFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc3ODQ5OSwiZXhwIjoyMDgyMzU0NDk5fQ.ebCn6X2LqjVTrj03RISmr1YVnvpgFeJz5pRygYdqzes";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log("🚀 Running migration 024...");

  const migrationSQL = fs.readFileSync(
    path.join(
      __dirname,
      "apps/api/migrations/024_add_config_type_for_api_configurations.sql"
    ),
    "utf8"
  );

  try {
    const { data, error } = await supabase.rpc("exec_sql", {
      sql: migrationSQL,
    });

    if (error) {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    }

    console.log("✅ Migration 024 completed successfully!");
    console.log("📋 Changes applied:");
    console.log("  - Added config_type column (ai/semantic)");
    console.log(
      "  - Added search_endpoint, results_limit, provider_meta columns"
    );
    console.log(
      "  - Extended provider constraint with exa, perplexity, tavily"
    );
    console.log("  - Created index on config_type");
  } catch (err) {
    console.error("❌ Error running migration:", err.message);
    process.exit(1);
  }
}

runMigration();
