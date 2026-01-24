# Design Decisions

## 2026-01-18 — Transkrypcja YouTube z Redis/BullMQ

- Zastąpiono in-memory queue systemem Redis/BullMQ dla persystencji zadań.
- `TranscriptionQueue` zarządza zadaniami, `TranscriptionWorker` przetwarza.
- `TranscriptionRecovery` automatycznie odzyskuje utknięte zadania co godzinę.
- Powód: odporność na restarty API, horizontal scaling, retry mechanism.
- Wpływ: wymagany Redis, worker musi działać dla przetwarzania.

## 2026-01-16 — Voice Command System (Stefan 2.0)

- Wake word "Hej Stefan" z trybem czuwania (standby → active → processing).
- `VoiceActionService` obsługuje akcje: kalendarz, zadania, dokumenty, nawigacja.
- Powód: hands-free obsługa aplikacji dla radnych.
- Wpływ: wymaga mikrofonu, TTS dla odpowiedzi głosowych.

## 2026-01-16 — Timeout STT z fallbackiem

- Dodano 10-minutowy timeout dla STT API call w `youtube-downloader.ts`.
- Fallback do OpenAI Whisper gdy lokalny provider nie odpowiada.
- Powód: zapobieganie wiszącym zadaniom w kolejce.
- Wpływ: długie nagrania mogą wymagać zwiększenia timeout.

## 2026-01-14 — Inteligentny Scraping (tylko AI, bez regex)

- Wszystkie dane strukturalne wyodrębniane przez AI (`IntelligentScraper.analyzeContentWithLLM()`).
- Usunięto fallbacki regex z `calendar-auto-import.ts`.
- Powód: spójność danych; AI rozumie kontekst lepiej niż regex.
- Wpływ: brak danych AI = brak importu do kalendarza (fail-safe).

## 2026-01-14 — Dynamic Deep Research providers

- `DeepResearchService` ładuje konfiguracje z `api_configurations`.
- Powód: indywidualne klucze użytkowników, szybkie wyłączanie providerów.

## 2026-01-14 — Jeden backend (Supabase PostgreSQL)

- Supabase (PostgreSQL + pgvector) jest jedyną bazą.
- Powód: audytowalność, brak vendor lock-in.

## 2026-01-11 — Multi-LLM architecture

- Oddzielenie OCR, Vision, LLM reasoning.
- Powód: wydajność, możliwość lokalnego uruchamiania, izolacja danych.

## 2026-01-11 — RAG with pgvector

- PostgreSQL + pgvector zamiast zewnętrznej bazy wektorowej.
- Powód: zgodność z wymogami prawnymi, jedno źródło prawdy.
