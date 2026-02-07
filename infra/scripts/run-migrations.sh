#!/bin/bash
# Skrypt do uruchomienia migracji na lokalnym Supabase
# Użycie: ./scripts/run-migrations.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/apps/api/migrations"

# Konfiguracja połączenia
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

export PGPASSWORD="$DB_PASSWORD"

echo "=== AAsystent Radnego - Migracje bazy danych ==="
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Sprawdź czy PostgreSQL jest dostępny
echo "Sprawdzanie połączenia z bazą danych..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
  echo "Czekam na PostgreSQL..."
  sleep 2
done
echo "✓ Połączenie z bazą danych OK"
echo ""

# Utwórz tabelę migracji jeśli nie istnieje
echo "Tworzenie tabeli migracji..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
" > /dev/null
echo "✓ Tabela migracji gotowa"
echo ""

# Uruchom migracje
echo "Uruchamianie migracji..."
MIGRATION_COUNT=0

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$migration_file" ]; then
    migration_name=$(basename "$migration_file")
    
    # Sprawdź czy migracja już została wykonana
    already_executed=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
      SELECT COUNT(*) FROM _migrations WHERE name = '$migration_name';
    ")
    
    if [ "$already_executed" -eq 0 ]; then
      echo "  → Wykonuję: $migration_name"
      
      # Wykonaj migrację
      if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" > /dev/null 2>&1; then
        # Zapisz wykonaną migrację
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
          INSERT INTO _migrations (name) VALUES ('$migration_name');
        " > /dev/null
        echo "    ✓ OK"
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
      else
        echo "    ✗ BŁĄD!"
        echo "    Migracja $migration_name nie powiodła się."
        exit 1
      fi
    else
      echo "  ○ Pominięto: $migration_name (już wykonana)"
    fi
  fi
done

echo ""
echo "=== Zakończono ==="
echo "Wykonano migracji: $MIGRATION_COUNT"
echo ""

# Pokaż statystyki
echo "Statystyki bazy danych:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
  schemaname,
  COUNT(*) as tables
FROM pg_tables 
WHERE schemaname IN ('public', 'auth', 'storage')
GROUP BY schemaname
ORDER BY schemaname;
"
