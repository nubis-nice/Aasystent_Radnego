# Infrastruktura lokalna - Supabase Self-hosted

## Szybki start

### 1. Konfiguracja

```bash
cd infra
cp .env.local.example .env.local
# Edytuj .env.local i ustaw własne hasła
```

### 2. Uruchomienie

```bash
# Pełny stack Supabase
docker compose -f docker-compose.yml -f docker-compose.supabase.yml up -d

# Lub tylko podstawowe usługi (bez Studio)
docker compose up -d
```

### 3. Migracje

```bash
# Linux/Mac
./scripts/run-migrations.sh

# Windows (PowerShell)
# Użyj pgAdmin lub Adminer na http://localhost:8080
```

## Usługi

| Usługa                 | Port  | URL                    |
| ---------------------- | ----- | ---------------------- |
| **Kong (API Gateway)** | 54321 | http://localhost:54321 |
| **Supabase Studio**    | 54323 | http://localhost:54323 |
| **PostgreSQL**         | 5433  | localhost:5433         |
| **Redis**              | 6379  | localhost:6379         |
| **Adminer**            | 8080  | http://localhost:8080  |
| **Whisper**            | 8000  | http://localhost:8000  |

## Konfiguracja aplikacji

### Backend (apps/api/.env)

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
```

### Frontend (apps/frontend/.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

## Struktura plików

```
infra/
├── docker-compose.yml           # Podstawowe usługi (PG, Redis, Whisper)
├── docker-compose.supabase.yml  # Pełny Supabase stack
├── docker-compose.e2e.yml       # Konfiguracja dla testów E2E
├── kong.yml                     # Konfiguracja Kong API Gateway
├── .env.local.example           # Przykładowe zmienne środowiskowe
├── init/
│   └── 00-init-supabase.sql     # Inicjalizacja ról i schematów
├── scripts/
│   └── run-migrations.sh        # Skrypt do uruchamiania migracji
└── README.md                    # Ten plik
```

## Generowanie kluczy JWT

Dla produkcji wygeneruj własne klucze:

```bash
# Wygeneruj JWT_SECRET
openssl rand -base64 32

# Wygeneruj klucze API używając:
# https://supabase.com/docs/guides/self-hosting#api-keys
```

## Rozwiązywanie problemów

### Baza danych nie startuje

```bash
# Sprawdź logi
docker compose logs postgres

# Zresetuj dane
docker compose down -v
docker compose up -d
```

### Auth nie działa

```bash
# Sprawdź logi GoTrue
docker compose logs auth

# Upewnij się że JWT_SECRET jest taki sam we wszystkich serwisach
```

### Storage nie działa

```bash
# Sprawdź logi
docker compose logs storage

# Upewnij się że wolumen storage_data istnieje
docker volume ls | grep storage
```

## Migracja z Supabase Cloud

1. Eksportuj dane z Supabase Cloud:

   ```bash
   pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
   ```

2. Importuj do lokalnej bazy:
   ```bash
   psql -h localhost -p 5433 -U postgres -d postgres < backup.sql
   ```

## Przydatne komendy

```bash
# Status usług
docker compose ps

# Logi wszystkich usług
docker compose logs -f

# Restart konkretnej usługi
docker compose restart auth

# Wejście do PostgreSQL
docker exec -it aasystent-postgres psql -U postgres

# Backup bazy
docker exec aasystent-postgres pg_dump -U postgres postgres > backup.sql
```
