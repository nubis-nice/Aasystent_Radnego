# Docker Infrastructure - Asystent Radnego

## Przegląd

System używa Docker Compose do uruchamiania usług infrastrukturalnych. **Baza PostgreSQL jest hostowana na Supabase** - nie używamy lokalnego PostgreSQL.

## Obrazy Docker

### 1. Redis (`redis:7-alpine`)

**Cel:** Cache i kolejki zadań (BullMQ)

```yaml
redis:
  image: redis:7-alpine
  container_name: aasystent-redis
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

**Użycie w aplikacji:**

- Cache konfiguracji AI (5 min TTL)
- Kolejki zadań transkrypcji
- Sesje użytkowników

---

### 2. Faster Whisper Server (`fedirz/faster-whisper-server:latest-cpu`)

**Cel:** Lokalna transkrypcja audio (STT) - alternatywa dla OpenAI Whisper API

```yaml
whisper:
  image: fedirz/faster-whisper-server:latest-cpu
  container_name: aasystent-whisper
  ports:
    - "8000:8000"
  environment:
    - WHISPER__MODEL=Systran/faster-whisper-medium
    - WHISPER__INFERENCE_DEVICE=cpu
  volumes:
    - whisper_cache:/root/.cache
```

**Konfiguracja w aplikacji:**

- Base URL: `http://localhost:8000`
- Model: `Systran/faster-whisper-medium`
- Endpoint: `/v1/audio/transcriptions` (OpenAI-compatible)

**Użycie:**

- Transkrypcja nagrań sesji rady (YouTube)
- Przetwarzanie plików audio użytkownika
- Analiza sentymentu wypowiedzi

---

### 3. Adminer (`adminer:4`) - Opcjonalny

**Cel:** Przeglądarka bazy danych (development only)

```yaml
adminer:
  image: adminer:4
  container_name: aasystent-adminer
  ports:
    - "8080:8080"
```

**Uwaga:** Używany tylko do debugowania lokalnego PostgreSQL, nie Supabase.

---

## Komendy

### Uruchomienie wszystkich usług

```bash
cd infra
docker-compose up -d
```

### Uruchomienie tylko Redis i Whisper (bez PostgreSQL)

```bash
docker-compose up -d redis whisper
```

### Zatrzymanie usług

```bash
docker-compose down
```

### Logi

```bash
docker-compose logs -f whisper
docker-compose logs -f redis
```

---

## Integracja z aplikacją

### Redis

```typescript
// W zmiennych środowiskowych
REDIS_URL=redis://localhost:6379

// Użycie w BullMQ
import { Queue } from 'bullmq';
const transcriptionQueue = new Queue('transcription', {
  connection: { host: 'localhost', port: 6379 }
});
```

### Faster Whisper (lokalny STT)

```typescript
// Konfiguracja w api_configurations
{
  provider: 'local',
  config_type: 'ai',
  base_url: 'http://localhost:8000',
  transcription_model: 'Systran/faster-whisper-medium'
}

// Użycie przez AIClientFactory
const sttClient = await getSTTClient(userId);
const transcription = await sttClient.audio.transcriptions.create({
  file: audioFile,
  model: 'Systran/faster-whisper-medium',
  language: 'pl'
});
```

---

## Wymagania systemowe

| Usługa        | RAM        | CPU     | Dysk               |
| ------------- | ---------- | ------- | ------------------ |
| Redis         | 256MB      | 1 core  | 1GB                |
| Whisper (CPU) | 4GB        | 4 cores | 5GB (cache modeli) |
| Whisper (GPU) | 2GB + VRAM | 2 cores | 5GB                |

---

## Volumes

```yaml
volumes:
  redis_data: # Dane Redis (cache, kolejki)
  whisper_cache: # Cache modeli Whisper (~2GB dla medium)
```

---

## Troubleshooting

### Whisper nie odpowiada

```bash
# Sprawdź logi
docker logs aasystent-whisper

# Restart
docker-compose restart whisper
```

### Redis connection refused

```bash
# Sprawdź czy działa
docker ps | grep redis

# Restart
docker-compose restart redis
```

### Brak miejsca na dysku (cache Whisper)

```bash
# Wyczyść cache modeli
docker volume rm aasystent-radnego_whisper_cache
docker-compose up -d whisper
```
