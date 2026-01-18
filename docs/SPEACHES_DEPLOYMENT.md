# Speaches STT/TTS z GPU Support - Deployment Guide

**Data**: 2026-01-16  
**Wersja**: 1.0  
**Bazuje na**: [speaches-ai/speaches](https://github.com/speaches-ai/speaches)

---

## 🎯 Czym jest Speaches?

**Speaches** to OpenAI API-kompatybilny serwer dla:

- **STT (Speech-to-Text)** - powered by faster-whisper
- **TTS (Text-to-Speech)** - powered by Piper i Kokoro (ranked #1 in TTS Arena)
- **Realtime API** - streaming transcription i speech-to-speech

**Dlaczego Speaches zamiast faster-whisper-server?**

- ✅ OpenAI API compatible - drop-in replacement
- ✅ STT + TTS w jednym kontenerze
- ✅ Dynamic model loading/offloading (oszczędność GPU memory)
- ✅ Streaming support
- ✅ Gradio UI out-of-the-box
- ✅ Actively maintained (34 contributors, regular releases)

---

## 📦 Architektura w projekcie

### Obecna infrastruktura:

```
┌─────────────────────────────────────────────────────────────┐
│ Aasystent Radnego Infrastructure                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  PostgreSQL (pgvector)  →  Port 5433                         │
│  Redis                  →  Port 6379                         │
│  Adminer                →  Port 8080                         │
│  Whisper (faster-whisper-server) → Port 8000 (OLD)          │
│                                                               │
│  API Server             →  Port 3001                         │
│  Worker                 →  Background                        │
│  Frontend (Next.js)     →  Port 3000                         │
└─────────────────────────────────────────────────────────────┘
```

### Po dodaniu Speaches:

```
┌─────────────────────────────────────────────────────────────┐
│ Aasystent Radnego Infrastructure + Speaches                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  PostgreSQL (pgvector)  →  Port 5433                         │
│  Redis                  →  Port 6379                         │
│  Adminer                →  Port 8080                         │
│  Speaches (STT+TTS)     →  Port 8001 (NEW) ⭐ GPU REQUIRED  │
│                                                               │
│  API Server             →  Port 3001                         │
│  Worker                 →  Background                        │
│  Frontend (Next.js)     →  Port 3000                         │
└─────────────────────────────────────────────────────────────┘
```

**Port change**: Zmieniono z 8000 → **8001** żeby uniknąć konfliktu z istniejącym Whisper.

---

## 🚀 Quick Start

### 1. Wymagania

**Hardware**:

- ✅ NVIDIA GPU z CUDA support (GTX 1060+ / RTX series)
- ✅ VRAM Requirements:
  - **4GB VRAM** (RTX 3050): medium model + int8
  - **6GB+ VRAM** (RTX 3060+): large-v3 model + float16
  - **8GB+ VRAM** (RTX 4060+): large-v3 model + float16 (recommended)
- ✅ ~10GB dysku (dla cached models)

**Software**:

- ✅ Docker + Docker Compose
- ✅ NVIDIA Docker Runtime (`nvidia-docker2`)
- ✅ NVIDIA CUDA Drivers

**Sprawdź GPU support**:

```powershell
docker run --rm --gpus all nvidia/cuda:12.6.3-base-ubuntu24.04 nvidia-smi
```

### 2. Deployment

**Uruchomienie**:

```powershell
# Z katalogu głównego projektu
cd d:\Aasystent_Radnego

# Uruchom Speaches z GPU
docker-compose -f docker-compose.speaches.yaml up -d

# Sprawdź logi
docker logs -f aasystent-speaches

# Sprawdź status
docker ps | findstr speaches
```

**Pierwsze uruchomienie**:

- Speaches pobierze modele automatycznie (~2-5 GB)
- Może potrwać 5-10 minut w zależności od internetu
- Health check będzie failował dopóki modele się nie załadują

**Weryfikacja**:

```powershell
# Health check
curl http://localhost:8001/health

# OpenAPI docs
curl http://localhost:8001/docs

# Gradio UI
# Otwórz: http://localhost:8001
```

---

## ⚙️ Konfiguracja

### Environment Variables

**Plik**: `speaches.env.example` → skopiuj do `.env`

**Kluczowe zmienne**:

```bash
# GPU Configuration
WHISPER__INFERENCE_DEVICE=cuda
WHISPER__COMPUTE_TYPE=float16  # float16 (accuracy) vs int8 (speed)

# Model TTL (keep models loaded)
STT_MODEL_TTL=600   # 10 min
TTS_MODEL_TTL=600
VAD_MODEL_TTL=-1    # Never unload VAD

# Preload models at startup
PRELOAD_MODELS=["Systran/faster-whisper-large-v3"]

# CORS (allow frontend/API)
ALLOW_ORIGINS=["http://localhost:3000","http://localhost:3001"]

# API Key (optional)
# API_KEY=secret-key-here
```

### Compute Type Trade-offs

| Compute Type   | Speed  | Accuracy | VRAM Usage |
| -------------- | ------ | -------- | ---------- |
| `float16`      | Slow   | High     | High       |
| `int8_float16` | Medium | Medium   | Medium     |
| `int8`         | Fast   | Lower    | Low        |

**Rekomendacja**:

- **RTX 3050 (4GB)**: `int8` + `medium` model
- **RTX 3060+ (6GB+)**: `float16` + `large-v3` model
- **RTX 4060+ (8GB+)**: `float16` + `large-v3` (optimal)

---

## 🔗 Integracja z API

### OpenAI-Compatible API

Speaches implementuje OpenAI API, więc istniejący kod działa out-of-the-box!

**Obecna konfiguracja** (faster-whisper-server):

```typescript
// apps/api/src/ai/ai-client-factory.ts
const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "not-needed",
});
```

**Nowa konfiguracja** (Speaches):

```typescript
const client = new OpenAI({
  baseURL: "http://localhost:8001/v1", // Zmieniony port
  apiKey: "not-needed", // lub secret jeśli włączony API_KEY
});
```

**Migracja**:

1. Zatrzymaj stary Whisper: `docker stop aasystent-whisper`
2. Uruchom Speaches: `docker-compose -f docker-compose.speaches.yaml up -d`
3. Zmień `baseURL` w konfiguracji AI provider (Settings → AI Config)
4. Test transkrypcji

**WAŻNE**: Nie trzeba zmieniać kodu! OpenAI SDK działa identycznie.

---

## 📊 Dostępne modele

### Speech-to-Text (Whisper)

Format model ID: `Systran/faster-whisper-{size}`

| Model             | Size  | Speed     | Accuracy  | VRAM |
| ----------------- | ----- | --------- | --------- | ---- |
| `tiny`            | 39M   | Very Fast | Low       | 1GB  |
| `base`            | 74M   | Fast      | Medium    | 1GB  |
| `small`           | 244M  | Medium    | Good      | 2GB  |
| `medium`          | 769M  | Slow      | Very Good | 5GB  |
| `large-v3`        | 1550M | Very Slow | Excellent | 6GB+ |
| `distil-large-v3` | 756M  | Medium    | Excellent | 4GB  |

**Rekomendacja dla produkcji**: `Systran/faster-whisper-large-v3`

### Text-to-Speech

**Kokoro** (Ranked #1 in TTS Arena) - tylko angielski:

- `speaches-ai/Kokoro-82M-v1.0-ONNX`
- Naturalny głos, świetna jakość
- Fast inference
- ⚠️ **NIE obsługuje polskiego**

---

## 🇵🇱 Polski TTS - alternatywy

### 1. Edge TTS (Darmowe, online) ⭐ REKOMENDOWANY

Darmowy TTS od Microsoft z doskonałą obsługą polskiego.

**Polskie głosy**:
| Głos | Opis |
|------|------|
| `pl-PL-ZofiaNeural` | Kobieta, naturalny ⭐ |
| `pl-PL-MarekNeural` | Mężczyzna, naturalny |

**Użycie API**:

```bash
# Test syntezy
curl -X POST http://localhost:3001/api/edge-tts/test \
  -H "Content-Type: application/json" \
  -d '{"text": "Witaj świecie!"}'

# Synteza z wyborem głosu
curl -X POST http://localhost:3001/api/edge-tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Witaj świecie!", "voice": "pl-PL-ZofiaNeural"}'

# Lista głosów
curl http://localhost:3001/api/edge-tts/voices
```

**Zalety**:

- ✅ Darmowe, bez limitu
- ✅ Doskonała jakość polskiego
- ✅ Nie wymaga GPU
- ✅ Wbudowane w API

**Wady**:

- ⚠️ Wymaga połączenia z internetem

### 2. Piper TTS (Darmowe, offline)

Lokalny neural TTS z polskimi głosami.

**Polskie głosy**:
| Model | Opis |
|-------|------|
| `pl_PL-gosia-medium` | Kobieta, wysoka jakość ⭐ |
| `pl_PL-darkman-medium` | Mężczyzna |
| `pl_PL-mc_speech-medium` | Kobieta |

**Uruchomienie**:

```bash
docker-compose -f docker-compose.piper.yaml up -d
```

**Zalety**:

- ✅ Darmowe
- ✅ Offline (prywatność)
- ✅ Szybkie

**Wady**:

- ⚠️ Niższa jakość niż Edge TTS

### Porównanie polskich TTS

| Cecha       | Edge TTS   | Piper      | Kokoro |
| ----------- | ---------- | ---------- | ------ |
| **Polski**  | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ❌     |
| **Jakość**  | Doskonała  | Dobra      | -      |
| **Offline** | ❌         | ✅         | -      |
| **GPU**     | Nie wymaga | Nie wymaga | -      |
| **Koszt**   | Darmowe    | Darmowe    | -      |

---

## 🎛️ Zarządzanie modelami

### Instalacja modeli

**Automatyczne przy użyciu**:

```typescript
// Model pobierze się automatycznie przy pierwszym użyciu
const transcription = await client.audio.transcriptions.create({
  file: audioFile,
  model: "Systran/faster-whisper-large-v3", // Auto-download if not cached
});
```

**Manualna instalacja** (rekomendowane):

```powershell
# Pobierz model przed pierwszym użyciem
curl -X POST http://localhost:8001/v1/models/Systran/faster-whisper-large-v3

# Sprawdź zainstalowane modele
curl http://localhost:8001/v1/models
```

**Czas pobierania**:

- `medium`: ~1.2GB, 2-5 min
- `large-v3`: ~2.6GB, 5-10 min

### Dynamic Loading

Modele są ładowane automatycznie przy pierwszym użyciu:

```typescript
// Użyj dowolnego modelu - zostanie załadowany automatycznie
const transcription = await client.audio.transcriptions.create({
  file: audioFile,
  model: "Systran/faster-whisper-large-v3", // Auto-download if not cached
});
```

### Preload na starcie

```bash
# W .env lub docker-compose
PRELOAD_MODELS=["Systran/faster-whisper-large-v3","rhasspy/piper-voices"]
```

### Model TTL (Time To Live)

```bash
STT_MODEL_TTL=600   # Unload after 10 min of inactivity
STT_MODEL_TTL=-1    # Never unload (keep in VRAM)
STT_MODEL_TTL=0     # Unload immediately after use
```

**Trade-off**:

- `-1`: Fast response, high VRAM usage
- `600`: Balanced (unload after 10 min idle)
- `0`: Low VRAM, slow (load model każdy request)

---

## 🧪 Testing

### 1. Health Check

```bash
curl http://localhost:8001/health
# Response: {"status":"ok"}
```

### 2. Transcription Test

```bash
curl -X POST http://localhost:8001/v1/audio/transcriptions \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_audio.mp3" \
  -F "model=Systran/faster-whisper-large-v3" \
  -F "language=pl"
```

### 3. TTS Test

```bash
curl -X POST http://localhost:8001/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kokoro",
    "input": "Witaj świecie!",
    "voice": "af_sky"
  }' \
  --output speech.mp3
```

### 4. Gradio UI

Otwórz http://localhost:8001 w przeglądarce - interfejs do testowania STT/TTS.

---

## 📈 Performance

### Transcription Benchmarks (large-v3, RTX 3080)

| Audio Length | Time (float16) | Time (int8) | Speedup |
| ------------ | -------------- | ----------- | ------- |
| 1 min        | 6s             | 3s          | 2x      |
| 10 min       | 45s            | 22s         | 2x      |
| 30 min       | 2m 15s         | 1m 10s      | ~2x     |
| 60 min       | 4m 30s         | 2m 20s      | ~2x     |

**Note**: int8 jest ~2x szybszy ale nieco niższa jakość.

### Memory Usage

| Model              | VRAM (idle) | VRAM (inferencing) |
| ------------------ | ----------- | ------------------ |
| large-v3 (float16) | ~3GB        | ~6GB               |
| large-v3 (int8)    | ~1.5GB      | ~3GB               |
| distil-large-v3    | ~2GB        | ~4GB               |

---

## 🔧 Troubleshooting

### Problem: "no CUDA-capable device is detected"

**Rozwiązanie**:

```powershell
# Sprawdź NVIDIA Docker runtime
docker run --rm --gpus all nvidia/cuda:12.6.3-base-ubuntu24.04 nvidia-smi

# Jeśli error, zainstaluj nvidia-docker2:
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
```

### Problem: "Model not found"

**Rozwiązanie**:

- Sprawdź format model ID: `Systran/faster-whisper-{size}`
- Poczekaj na auto-download (pierwsze użycie)
- Sprawdź logi: `docker logs aasystent-speaches`

### Problem: Out of Memory (CUDA OOM)

**Rozwiązanie**:

1. Użyj mniejszego modelu: `large-v3` → `distil-large-v3` → `medium`
2. Zmień compute type: `float16` → `int8`
3. Zmniejsz batch size (jeśli używasz batch processing)
4. Włącz aggressive model unloading: `STT_MODEL_TTL=0`

### Problem: Slow transcription

**Rozwiązanie**:

1. Sprawdź czy używa GPU: `docker stats aasystent-speaches` (powinien używać GPU)
2. Zmień na int8: `WHISPER__COMPUTE_TYPE=int8`
3. Użyj mniejszego modelu: `distil-large-v3`
4. Preload model: `PRELOAD_MODELS=["Systran/faster-whisper-large-v3"]`

### Problem: Port 8001 already in use

**Rozwiązanie**:

```yaml
# W docker-compose.speaches.yaml zmień port:
ports:
  - "8002:8000" # Lub inny wolny port
```

---

## 📚 Dokumentacja i Zasoby

**Oficjalna dokumentacja**:

- [Speaches Docs](https://speaches.ai/)
- [GitHub repo](https://github.com/speaches-ai/speaches)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference/audio)

**Modele**:

- [Faster Whisper](https://github.com/SYSTRAN/faster-whisper)
- [Piper TTS](https://github.com/rhasspy/piper)
- [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M)

**Related Docs w projekcie**:

- `docs/FIX_STT_TIMEOUT_PROBLEM.md` - timeout handling
- `docs/MVP_AUDIO_CHUNKING.md` - chunked transcription
- `docs/DESIGN_AUDIO_CHUNKING_SYSTEM.md` - full design

---

## 🚀 Production Checklist

### Pre-deployment:

- [ ] GPU drivers zainstalowane (`nvidia-smi` działa)
- [ ] NVIDIA Docker runtime zainstalowany
- [ ] Port 8001 wolny (lub zmieniony w docker-compose)
- [ ] Min 10GB wolnego miejsca na dysku (models cache)
- [ ] Min 6GB VRAM dla large-v3

### Deployment:

- [ ] Docker Compose up: `docker-compose -f docker-compose.speaches.yaml up -d`
- [ ] Health check OK: `curl http://localhost:8001/health`
- [ ] Model preload complete (sprawdź logi)
- [ ] Test transcription z krótkim plikiem
- [ ] Test z 10+ min plikiem (dla pewności)

### Integration:

- [ ] Zmiana baseURL w AI provider config (Settings)
- [ ] Test z real YouTube video
- [ ] Weryfikacja audio preprocessing działa
- [ ] Sprawdzenie chunked transcription (dla 30+ min)
- [ ] Monitoring GPU usage (`nvidia-smi`)

### Monitoring:

- [ ] Health checks w Uptime Kuma/Grafana
- [ ] Disk space dla models cache
- [ ] GPU memory usage alerts
- [ ] Transcription latency metrics

---

## 🔄 Migration from faster-whisper-server

### Step-by-step:

**1. Backup (optional)**:

```powershell
docker commit aasystent-whisper backup-whisper-$(Get-Date -Format 'yyyyMMdd')
```

**2. Stop old Whisper**:

```powershell
docker stop aasystent-whisper
# Nie usuwaj jeszcze, na wypadek rollback
```

**3. Start Speaches**:

```powershell
docker-compose -f docker-compose.speaches.yaml up -d
```

**4. Update AI Config**:

- Idź do Settings → AI Configuration
- STT Provider → zmień base URL: `http://localhost:8000/v1` → `http://localhost:8001/v1`
- Save

**5. Test**:

- Utwórz test transcription job
- Sprawdź logi Worker: `cd apps/worker && npm run dev`
- Zweryfikuj output

**6. Cleanup (po 24h stabilnego działania)**:

```powershell
docker rm aasystent-whisper
docker volume rm aasystent-whisper-models  # jeśli istnieje
```

**Rollback (if needed)**:

```powershell
docker-compose -f docker-compose.speaches.yaml down
docker start aasystent-whisper
# Przywróć old baseURL w AI Config
```

---

## 💡 Tips & Best Practices

### 1. Model Selection

- **Development**: `distil-large-v3` (fast, good quality)
- **Production**: `large-v3` (best accuracy)
- **Low VRAM**: `medium` lub `small`

### 2. Compute Type

- **Production**: `float16` (best quality)
- **High throughput**: `int8` (2x faster, 90% quality)

### 3. Model TTL

- **Low traffic**: `STT_MODEL_TTL=300` (5 min)
- **High traffic**: `STT_MODEL_TTL=-1` (never unload)
- **Multi-user**: `STT_MODEL_TTL=600` (10 min)

### 4. Preloading

Preload najczęściej używane modele:

```bash
PRELOAD_MODELS=["Systran/faster-whisper-large-v3"]
```

### 5. Security

W produkcji włącz API key:

```bash
API_KEY=random-secret-key-$(uuidgen)
```

### 6. Monitoring

Obserwuj:

- GPU memory: `nvidia-smi dmon`
- Docker stats: `docker stats aasystent-speaches`
- Disk space: modele cached w `/home/ubuntu/.cache/huggingface/hub`

---

## 📊 Comparison: faster-whisper-server vs Speaches

| Feature                | faster-whisper-server | Speaches                    |
| ---------------------- | --------------------- | --------------------------- |
| **STT**                | ✅ Whisper            | ✅ Whisper (faster-whisper) |
| **TTS**                | ❌                    | ✅ Piper + Kokoro           |
| **API**                | Custom                | ✅ OpenAI Compatible        |
| **Streaming**          | ❌                    | ✅ SSE                      |
| **Dynamic loading**    | ❌ (manual)           | ✅ Automatic                |
| **Web UI**             | ❌                    | ✅ Gradio                   |
| **Realtime API**       | ❌                    | ✅                          |
| **Active development** | Moderate              | ✅ Very active              |
| **GPU Support**        | ✅                    | ✅                          |
| **Multi-model**        | Single at a time      | ✅ Dynamic switching        |

**Verdict**: Speaches jest bardziej feature-rich i aktywnie rozwijany. Idealny dla AI voice applications.

---

**Status**: ✅ **Ready for deployment**  
**Next**: Test z real YouTube videos i migracja z faster-whisper-server

**Estimated migration time**: 30 min
