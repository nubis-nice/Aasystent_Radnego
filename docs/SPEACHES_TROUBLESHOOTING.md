# Speaches Troubleshooting Guide

## ⚠️ CUDA Out of Memory

**Symptom**:

```
RuntimeError: CUDA failed with error out of memory
```

**Cause**: GPU nie ma wystarczającej VRAM dla wybranego modelu + compute type.

### Rozwiązanie

**1. Sprawdź VRAM**:

```powershell
nvidia-smi
# Szukaj "Memory-Usage" - np. 3853MiB / 4096MiB
```

**2. Wybierz odpowiedni model + compute type**:

| GPU       | VRAM | Rekomendacja                                 |
| --------- | ---- | -------------------------------------------- |
| RTX 3050  | 4GB  | `medium` + `int8`                            |
| RTX 3060  | 6GB  | `medium` + `float16` lub `large-v3` + `int8` |
| RTX 3070+ | 8GB+ | `large-v3` + `float16`                       |

**3. Zmień konfigurację**:

**Plik**: `docker-compose.speaches.yaml`

```yaml
environment:
  - WHISPER__COMPUTE_TYPE=int8 # Zmień z float16 na int8
```

**4. Restart**:

```powershell
docker-compose -f docker-compose.speaches.yaml down
docker-compose -f docker-compose.speaches.yaml up -d
```

**5. Zainstaluj mniejszy model**:

```powershell
# Usuń large-v3, zainstaluj medium
curl -X POST http://localhost:8001/v1/models/Systran/faster-whisper-medium
```

---

## 📥 Model nie instaluje się automatycznie

**Symptom**:

```
Model 'Systran/faster-whisper-large-v3' is not installed locally.
You can download the model using `POST /v1/models`
```

**Rozwiązanie**: Manualny download modelu.

```powershell
# Instalacja modelu
curl -X POST "http://localhost:8001/v1/models/Systran/faster-whisper-large-v3"

# Monitoring (inny terminal)
docker logs -f aasystent-speaches

# Weryfikacja
curl http://localhost:8001/v1/models
```

**Czas trwania**:

- `medium`: 2-5 min
- `large-v3`: 5-10 min (2.6GB)

**Cache location**: `/home/ubuntu/.cache/huggingface/hub` (persistent volume)

---

## 🔍 Pusta lista modeli

**Symptom**:

```json
{ "data": [], "object": "list" }
```

**Cause**: Brak zainstalowanych modeli (PRELOAD_MODELS=[]).

**Rozwiązanie**:

1. Frontend pokaże domyślną listę modeli
2. Wybierz model (np. `Systran/faster-whisper-medium`)
3. Model pobierze się przy pierwszym użyciu

**Lub manualnie**:

```powershell
curl -X POST http://localhost:8001/v1/models/Systran/faster-whisper-medium
```

---

## 🐳 Docker Desktop API Error 500

**Symptom**:

```
request returned 500 Internal Server Error for API route and version
```

**Rozwiązanie**: Restart Docker Desktop.

```powershell
# PowerShell
Stop-Process -Name "Docker Desktop" -Force
Start-Sleep -Seconds 5
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Poczekaj 30s na restart Docker
Start-Sleep -Seconds 30

# Ponowny pull
docker-compose -f docker-compose.speaches.yaml pull
docker-compose -f docker-compose.speaches.yaml up -d
```

---

## 🚀 Health Check Failed

**Symptom**: Container restartuje się ciągle.

**Debug**:

```powershell
docker logs aasystent-speaches --tail 100
docker inspect aasystent-speaches
```

**Common causes**:

1. **Brak GPU support**: Sprawdź `nvidia-smi` w kontenerze
2. **Port conflict**: Zmień 8001 na inny port
3. **CUDA drivers**: Update NVIDIA drivers

---

## 💾 Disk Space Issues

**Sprawdź rozmiar cache**:

```powershell
docker exec aasystent-speaches du -sh /home/ubuntu/.cache/huggingface/hub
```

**Cleanup starych modeli**:

```powershell
# Usuń cache
docker exec aasystent-speaches rm -rf /home/ubuntu/.cache/huggingface/hub/models--*

# Restart
docker-compose -f docker-compose.speaches.yaml restart
```

---

## 📊 Model Performance Issues

**Symptom**: Transkrypcja trwa bardzo długo.

**Diagnoza**:

```powershell
# Monitor GPU usage
nvidia-smi -l 1

# Sprawdź compute type
docker exec aasystent-speaches env | findstr COMPUTE_TYPE
```

**Optimization**:

1. **int8 zamiast float16**: 2x szybciej, ~5% mniej accurate
2. **medium zamiast large-v3**: 2x szybciej, ~10% mniej accurate
3. **Zwiększ MODEL_TTL**: Keep model w VRAM dłużej

---

## 🌐 CORS Errors

**Symptom**: Frontend nie może połączyć się ze Speaches.

**Fix**: Dodaj origin w `docker-compose.speaches.yaml`:

```yaml
environment:
  - ALLOW_ORIGINS=["http://localhost:3000","http://YOUR_IP:3000"]
```

**Restart**:

```powershell
docker-compose -f docker-compose.speaches.yaml restart
```

---

## 📝 Logs & Debugging

**Viewing logs**:

```powershell
# Real-time
docker logs -f aasystent-speaches

# Last 100 lines
docker logs aasystent-speaches --tail 100

# Grep errors
docker logs aasystent-speaches 2>&1 | findstr error
```

**Container stats**:

```powershell
docker stats aasystent-speaches
```

**GPU monitoring**:

```powershell
# Real-time GPU usage
nvidia-smi -l 1

# Memory usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```
