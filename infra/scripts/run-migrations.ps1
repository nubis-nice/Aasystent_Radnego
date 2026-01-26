# Skrypt do uruchomienia migracji na lokalnym Supabase (Windows PowerShell)
# Użycie: .\scripts\run-migrations.ps1

param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5433",
    [string]$DbName = "postgres",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$MigrationsDir = Join-Path $ProjectRoot "apps\api\migrations"

Write-Host "=== AAsystent Radnego - Migracje bazy danych ===" -ForegroundColor Cyan
Write-Host "Host: ${DbHost}:${DbPort}"
Write-Host "Database: $DbName"
Write-Host "User: $DbUser"
Write-Host ""

# Ustaw zmienną środowiskową dla hasła
$env:PGPASSWORD = $DbPassword

# Sprawdź czy psql jest dostępny
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "BŁĄD: psql nie znaleziony. Zainstaluj PostgreSQL lub dodaj do PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternatywnie użyj Adminer: http://localhost:8080" -ForegroundColor Yellow
    Write-Host "  System: PostgreSQL"
    Write-Host "  Server: postgres (lub localhost:5433 z zewnątrz)"
    Write-Host "  Username: postgres"
    Write-Host "  Password: postgres"
    Write-Host "  Database: postgres"
    exit 1
}

# Funkcja do wykonywania zapytań SQL
function Invoke-Sql {
    param([string]$Query)
    $result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -tAc $Query 2>&1
    return $result
}

function Invoke-SqlFile {
    param([string]$FilePath)
    & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $FilePath 2>&1
}

# Sprawdź połączenie
Write-Host "Sprawdzanie połączenia z bazą danych..." -ForegroundColor Yellow
$maxRetries = 10
$retryCount = 0

while ($retryCount -lt $maxRetries) {
    try {
        $testResult = Invoke-Sql "SELECT 1"
        if ($testResult -eq "1") {
            Write-Host "✓ Połączenie z bazą danych OK" -ForegroundColor Green
            break
        }
    } catch {
        # Ignoruj błędy podczas próby połączenia
    }
    
    $retryCount++
    Write-Host "Czekam na PostgreSQL... ($retryCount/$maxRetries)"
    Start-Sleep -Seconds 2
}

if ($retryCount -eq $maxRetries) {
    Write-Host "BŁĄD: Nie można połączyć się z bazą danych" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Utwórz tabelę migracji
Write-Host "Tworzenie tabeli migracji..." -ForegroundColor Yellow
$createTableSql = @"
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
"@
Invoke-Sql $createTableSql | Out-Null
Write-Host "✓ Tabela migracji gotowa" -ForegroundColor Green
Write-Host ""

# Uruchom migracje
Write-Host "Uruchamianie migracji..." -ForegroundColor Yellow
$migrationCount = 0
$errorCount = 0

$migrationFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name

foreach ($file in $migrationFiles) {
    $migrationName = $file.Name
    
    # Sprawdź czy już wykonana
    $alreadyExecuted = Invoke-Sql "SELECT COUNT(*) FROM _migrations WHERE name = '$migrationName'"
    
    if ($alreadyExecuted -eq "0") {
        Write-Host "  → Wykonuję: $migrationName" -ForegroundColor White
        
        try {
            $result = Invoke-SqlFile $file.FullName
            
            # Zapisz wykonaną migrację
            Invoke-Sql "INSERT INTO _migrations (name) VALUES ('$migrationName')" | Out-Null
            
            Write-Host "    ✓ OK" -ForegroundColor Green
            $migrationCount++
        } catch {
            Write-Host "    ✗ BŁĄD: $_" -ForegroundColor Red
            $errorCount++
            # Kontynuuj z następnymi migracjami
        }
    } else {
        Write-Host "  ○ Pominięto: $migrationName (już wykonana)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "=== Zakończono ===" -ForegroundColor Cyan
Write-Host "Wykonano migracji: $migrationCount" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "Błędy: $errorCount" -ForegroundColor Red
}
Write-Host ""

# Statystyki
Write-Host "Statystyki bazy danych:" -ForegroundColor Yellow
$stats = Invoke-Sql @"
SELECT schemaname || ': ' || COUNT(*) || ' tabel'
FROM pg_tables 
WHERE schemaname IN ('public', 'auth', 'storage')
GROUP BY schemaname
ORDER BY schemaname;
"@
$stats | ForEach-Object { Write-Host "  $_" }

# Cleanup
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
