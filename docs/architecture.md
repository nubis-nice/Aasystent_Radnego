# Architektura: Asystent Radnego (Gmina Drawno)

## 1. Cel systemu
System automatyzuje obieg dokumentów Rady Miejskiej (pozyskanie, ekstrakcja treści multimodalnym LLM, analiza, wyszukiwanie) i udostępnia Radnemu panel/czat do pracy z materiałami wraz z cytatami oraz sygnałami ryzyk.

## 2. Założenia niefunkcjonalne (inwarianty)
- **Deterministyczność**: domyślnie `temperature=0`, wersjonowanie promptów.
- **Kontrakty danych**: wszystkie wejścia/wyjścia walidowane (Zod), wersjonowane (`v1`).
- **Fail fast**: błąd, gdy brak tekstu po ekstrakcji / brak metadanych krytycznych / uszkodzony plik.
- **Obserwowalność**: logi JSON z `traceId`, czasy etapów, statusy jobów.
- **Bezpieczeństwo**: klucze API tylko w zmiennych środowiskowych; brak danych wrażliwych w logach.

## 3. Stos technologiczny (docelowo)

## 3.1. Repozytorium (monorepo)
Projekt jest utrzymywany jako monorepo (**npm workspaces**) z osobnymi aplikacjami uruchomieniowymi w `apps/*` (frontend/api/worker) oraz współdzielonym kodem w `packages/*`.

- **Runtime**: Node.js LTS
- **Język**: TypeScript
- **Backend**: Fastify (lub NestJS + Fastify)
- **Kolejka**: BullMQ + Redis
- **DB**: PostgreSQL + pgvector
- **Ekstrakcja treści z dokumentów/skanów**: multimodalny LLM (OpenAI)
- **LLM**: OpenAI + tool calling
- **UI**: panel webowy (np. Next.js) + czat

## 4. Moduły i odpowiedzialności
### 4.1. Ingest (pobieranie)
- Pobiera dokumenty z BIP/systemu „Rada”.
- Deduplikacja: `hash` pliku + URL.
- Zapis pliku źródłowego.

### 4.2. Normalizer
- Identyfikuje format (PDF/DOCX/skan).
- Konwersja do formatu roboczego (jeśli potrzebne).

### 4.3. Ekstrakcja treści (multimodal)
- Ekstrakcja tekstu i struktury z PDF/skanów przez multimodalny LLM.
- `qualityScore` + walidacja minimalnej jakości.

### 4.4. Metadane
- Tytuł, numer, data, autor, temat/tags.
- Źródło i identyfikatory.

### 4.5. Index/RAG
- Chunking + embedding (OpenAI embedding).
- Przechowywanie wektorów w pgvector.

### 4.6. Analizy
- Streszczenie, kluczowe punkty.
- Powiązania uchwał.
- Skan ryzyk (MVP: heurystyki + cytaty).

### 4.7. Transkrypcja sesji rady (audio/wideo)
- Pobranie/załadowanie nagrań sesji rady.
- Transkrypcja (ASR) w OpenAI + segmentacja czasowa.
- Indeksowanie transkryptu do wyszukiwania i Q&A.

### 4.8. Scenopisy sesji rady
- Generowanie scenopisu na bazie transkryptu (agenda -> tematy -> wypowiedzi -> wnioski/decyzje).
- Wersje: krótkie podsumowanie oraz szczegółowy przebieg.

### 4.9. UI / Chat
- Lista dokumentów i analiz.
- Q&A z cytatami.
- Raporty okresowe.

## 5. Tool calling (narzędzia LLM)
LLM wywołuje narzędzia aplikacyjne zamiast „wymyślać” wyniki. Każde narzędzie:
- ma schemat wejścia/wyjścia (Zod), wersję (`v1`),
- loguje `traceId`,
- zwraca dane do cytowania.

Minimalny zestaw (MVP):
- `search_documents`
- `get_document`
- `get_document_citations`
- `summarize_document`
- `qa_over_documents`
- `find_related_resolutions`
- `generate_weekly_report`
- `generate_session_brief`
- `legal_risk_scan`
- `transcribe_session_recording`
- `generate_session_screenplay`

## 6. Model danych (skrót)
- `Document`, `DocumentVersion`, `ExtractedText`, `Metadata`, `Chunk`, `Analysis`, `Recording`, `Transcript`, `Screenplay`

## 7. Konfiguracja OpenAI (bezpieczna)
- `OPENAI_API_KEY` (w `.env`, nie commitować)
- `OPENAI_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- opcjonalnie: `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`

## 8. Granice odpowiedzialności
- System dostarcza **wsparcie analityczne** i sygnały ryzyk; nie zastępuje opinii prawnej.
