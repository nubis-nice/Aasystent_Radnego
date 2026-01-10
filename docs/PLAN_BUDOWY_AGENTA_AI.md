# Plan budowy Agenta AI dla Radnego Miejskiego (Gmina Drawno)

## 1. Cel i zakres
Celem jest stworzenie Agenta AI, który automatycznie pozyskuje i przetwarza dokumenty Rady Miejskiej (uchwały, projekty uchwał, protokoły, załączniki), a następnie dostarcza Radnemu:

- **streszczenia i kluczowe punkty** ("o co chodzi" i "co się zmienia")
- **wyszukiwanie i Q&A z cytatami** (odpowiedzi zawsze poparte fragmentami dokumentów)
- **powiązania między dokumentami** (np. uchwała zmieniająca poprzednią)
- **wstępną analizę prawną/ryzyk** (sygnały ostrzegawcze dot. kompetencji i kolizji z prawem)
- **raporty okresowe** (tydzień/miesiąc) i podsumowanie sesji

Zakres zgodny z dokumentem wstępnym: `docs/_tylko_jako_notatka.md`.

## 2. Użytkownik i potrzeby (profil: Radny Miejski w Polsce)
### 2.1. Główne potrzeby
- **Oszczędność czasu**: szybkie zrozumienie dokumentów bez czytania całości.
- **Pewność decyzji**: wskazanie konsekwencji (finansowych, organizacyjnych, prawnych) i ryzyk.
- **Śledzenie historii**: co zmienia się względem poprzednich uchwał, jak to się łączy z budżetem/WPF.
- **Przygotowanie do sesji/komisji**: gotowe pytania kontrolne, lista wątpliwości.
- **Archiwizacja i wyszukiwanie**: szybkie dojście do konkretnego paragrafu i cytatu.

### 2.2. Typowe przypadki użycia
- **Nowy projekt uchwały**: streszczenie + ryzyka + lista pytań do urzędników.
- **Zmiany budżetowe/WPF**: wykrycie, czego dotyczą przesunięcia i wpływ na zadania.
- **Regulaminy i akty prawa miejscowego**: kontrola kompetencji rady i zgodności z ustawami.
- **Skany/załączniki**: ekstrakcja treści multimodalnym LLM i łączenie w jeden raport.
- **Szybkie Q&A**: "czy uchwała przewiduje podwyżkę opłaty?" + cytat.

## 3. Założenia projektowe (reguły jakości)
- **Deterministyczność**: domyślnie `temperature=0`, stałe szablony promptów, wersjonowanie promptów.
- **Jawna intencja modułów**: każdy moduł ma jeden cel i kontrakt (wejście/wyjście, błędy).
- **Kontrakty danych**: walidacja wejść/wyjść (Zod), wersjonowanie schematów.
- **Fail fast**: przerwanie przetwarzania na niespójnościach (np. brak tekstu po ekstrakcji treści).
- **Obserwowalność**: logi strukturalne (JSON), `traceId`, metryki czasu etapów.
- **Bezpieczeństwo**: brak danych wrażliwych w logach, kontrola dostępu do panelu.

## 4. Proponowana architektura (TypeScript, środowisko kompatybilne)

### 4.0. Repozytorium (monorepo) – drzewo katalogów
Rekomendowany układ repozytorium (Windows 11 + **npm workspaces** + **Docker Compose**):

```text
Aasystent_Radnego/
  apps/
    frontend/                  # Next.js (panel dokumentów + czat)
    api/                       # Fastify REST API (auth, CRUD, search, enqueue jobów)
    worker/                    # BullMQ worker (ingest, ekstrakcja, analizy, embeddingi)
  packages/
    shared/                    # współdzielone typy i kontrakty (Zod)
  infra/
    docker-compose.yml         # Postgres (pgvector) + Redis + Adminer
  docs/                        # dokumentacja
  scripts/                     # skrypty dev/CI (np. seed, reset db)
  .vscode/                     # tasks/launch/settings dla lokalnego dev
  package.json                 # root (workspaces + skrypty)
  tsconfig.base.json
  .env.example
```

**Uzasadnienie**:
- `apps/*` to osobne artefakty uruchomieniowe (łatwe skalowanie i deployment).
- `packages/*` to współdzielone biblioteki (kontrakty danych, schematy Zod) bez mieszania zależności UI.
- `infra/*` trzyma zależności środowiskowe (DB/Redis) uruchamiane w dev/CI.

### 4.1. Technologia
- **Runtime**: Node.js LTS (np. 20+)
- **Język**: TypeScript
- **Backend (API)**: Fastify lub NestJS (z Fastify) + REST (opcjonalnie później: GraphQL)
- **Backend (Worker)**: odseparowany proces/usługa do zadań asynchronicznych (ekstrakcja treści, analiza, embeddingi, raporty, transkrypcje)
- **Kolejka zadań**: BullMQ + Redis (rekomendowane od początku, bo Worker ma być oddzielny)
- **Baza danych**: PostgreSQL
- **Wyszukiwanie semantyczne**: pgvector (w Postgres) albo Qdrant (opcjonalnie)
- **Ekstrakcja treści z dokumentów/skanów**: multimodalny LLM (OpenAI)
- **LLM**: OpenAI (tryb deterministyczny, z narzędziami do zadań Radnego)
- **Frontend**: panel webowy (np. Next.js) + czat

Podział na komponenty uruchomieniowe:
- **Frontend**: UI (panel dokumentów, czat, raporty)
- **Backend API**: autoryzacja, CRUD dokumentów, wyszukiwanie, endpointy do Q&A, uruchamianie jobów
- **Backend Worker**: wykonuje joby z kolejki, zapisuje wyniki do DB, publikuje status

### 4.2. Moduły systemu (kontrakty)
- **Ingest** (pobieranie): wykrywa nowe dokumenty z systemu "Rada"/BIP i pobiera pliki.
- **Normalizer plików**: wykrywa typ (PDF/DOCX/skan), konwersje do formatu roboczego.
- **Ekstrakcja treści (multimodal)**: ekstrakcja tekstu/struktury z PDF i skanów + kontrola jakości.
- **Ekstrakcja metadanych**: tytuł, numer, data, autor, temat + źródło URL.
- **Archiwizacja**: zapis pliku źródłowego, wersjonowanie i deduplikacja.
- **Analiza treści**: streszczenie, punkty kluczowe, klasyfikacja tematyczna.
- **Powiązania**: linkowanie do uchwał po numerach, datach, cytatach "zmienia uchwałę".
- **Analiza prawna (MVP = heurystyki + sygnały)**: lista potencjalnych ryzyk i pytań kontrolnych.
- **RAG/Q&A**: odpowiedzi z cytatami i wskazaniem dokumentu/strony/akapitów.
- **Raportowanie**: raport tygodniowy/miesięczny + podsumowanie sesji.
- **Transkrypcja sesji rady**: przetwarzanie audio/wideo -> transkrypt z segmentami czasowymi.
- **Scenopis sesji rady**: streszczenie przebiegu sesji na bazie transkryptu.
- **UI**: panel dokumentów + czat + filtry.

Przypisanie modułów do komponentów:
- **Backend API**: UI/Chat, wyszukiwanie, autoryzacja, orkiestracja (enqueue jobów)
- **Backend Worker**: ingest/ekstrakcja treści/analizy/embeddingi/raporty/transkrypcje (joby), update statusów

### 4.3. OpenAI: konfiguracja, modele, deterministyczność
- **SDK**: oficjalny klient OpenAI dla Node.js/TypeScript.
- **Deterministyczność**:
  - `temperature=0`
  - stałe szablony promptów + wersjonowanie promptów
  - jawne parametry modeli (model, embedding model)
- **Zmienne środowiskowe (bez wklejania klucza do repozytorium)**:
  - `OPENAI_API_KEY` (WYMAGANE)
  - `OPENAI_MODEL` (np. model do streszczeń/Q&A)
  - `OPENAI_EMBEDDING_MODEL` (model do embeddingów w RAG)
  - `OPENAI_BASE_URL` (opcjonalnie, jeśli używasz proxy)
  - `OPENAI_ORG_ID` (opcjonalnie)
  - `OPENAI_PROJECT_ID` (opcjonalnie)
 - **Kontrola kosztów i limitów (zalecane)**:
   - limity po stronie OpenAI (budżety/limity projektu)
   - limity aplikacyjne: maks. rozmiar dokumentu na analizę, limit tokenów odpowiedzi, limit liczby cytatów
   - cache wyników analiz (hash dokumentu -> wynik streszczenia/ryzyk)

Przykład ustawień (DO WŁASNEGO `.env`, nie commitować do repozytorium):

```env
OPENAI_API_KEY=***WPROWADZ_TUTAJ_SWÓJ_KLUCZ***
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
```

### 4.4. Narzędzia (tool calling) dla zadań Radnego
LLM ma być wyposażony w narzędzia, które wykonują konkretne, weryfikowalne operacje w systemie (z walidacją wejścia/wyjścia i logowaniem).

Minimalny zestaw narzędzi (MVP):
- `search_documents` (wyszukiwanie po metadanych i treści)
- `get_document` (pobranie dokumentu i metadanych po `documentId`)
- `get_document_citations` (pobranie fragmentów/stron do cytowania)
- `summarize_document` (generacja streszczenia i kluczowych punktów)
- `qa_over_documents` (Q&A po wybranym zbiorze dokumentów z cytatami)
- `find_related_resolutions` (wykrywanie powiązań: "zmienia/uchyla/wykonuje")

Narzędzia "pracy Radnego" (rozszerzenie po MVP, ale projektowane od początku):
- `extract_action_items` (wykrycie obowiązków/terminów/odpowiedzialnych z dokumentu)
- `draft_questions_for_session` (propozycja pytań na komisję/sesję + cytaty)
- `draft_interpellation` (szkic interpelacji/zapytania radnego na podstawie problemu i materiałów)
- `compare_documents` (porównanie wersji/projekt vs uchwała, wskazanie różnic + cytaty)
- `budget_change_scan` (heurystyki dla zmian budżetowych/WPF: wykrycie przesunięć/kwot/rozdziałów, jeśli dane są w dokumencie)

Narzędzia raportowe:
- `generate_weekly_report`
- `generate_session_brief` (brief na sesję/komisję)

Narzędzia ryzyk (MVP = sygnały/heurystyki + cytaty):
- `legal_risk_scan` (lista ryzyk + pytania kontrolne + cytaty)

Narzędzia sesyjne (audio/wideo):
- `transcribe_session_recording` (transkrypcja nagrania + segmenty czasowe)
- `generate_session_screenplay` (scenopis na bazie transkryptu + cytaty/odniesienia do czasu)

Kontrakty danych:
- każde narzędzie ma schemat wejścia/wyjścia (Zod) i wersję `v1`
- odpowiedzi w UI muszą zawierać: `answer`, `citations[]`, `sourceDocuments[]`

## 5. Dane i integracje (Drawno)
### 5.1. Źródła dokumentów (do potwierdzenia)
- **System "Rada"** (konkretny vendor/URL)
- **BIP gminy** (uchwały, protokoły)
- **eSesja / transmisje** (opcjonalnie później)

### 5.2. Model danych (minimum)
- `Document` (id, source, url, hash, type, createdAt, sessionId?)
- `DocumentVersion` (documentId, version, filePath, extractionStatus)
- `ExtractedText` (documentVersionId, text, qualityScore)
- `Metadata` (title, number, date, author, topic, tags)
- `Chunk` (documentVersionId, text, embedding, pageRef)
- `Analysis` (summary, keyPoints, risks, links)
- `Recording` (źródło audio/wideo sesji)
- `Transcript` (transkrypt z segmentami czasowymi)
- `Screenplay` (scenopis wygenerowany z transkryptu)

## 6. Plan realizacji (etapy)
### Etap 0: Uzgodnienia i konfiguracja (1-3 dni)
- Potwierdzenie źródeł dokumentów (URL, logowanie, formaty).
- Ustalenie polityki danych (gdzie przechowujemy pliki, jak długo).
- Konfiguracja OpenAI (modele, zmienne środowiskowe, limity kosztów).
- Ustalenie podejścia do ekstrakcji treści dokumentów (multimodalny LLM) oraz limitów rozmiaru plików.
- Ustalenie źródła nagrań sesji (BIP/transmisje/YouTube/pliki lokalne) i formatu audio.

**Kryterium zakończenia**: spisana lista źródeł + dostęp testowy + definicja minimalnych pól metadanych.

### Etap 1: MVP "Dokument -> Streszczenie" (1-2 tyg.)
- Pobieranie dokumentów i wykrywanie nowości.
- Ekstrakcja treści z PDF/skanów (multimodalny LLM).
- Ekstrakcja metadanych.
- Streszczenie + kluczowe punkty.
- Panel listy dokumentów + podgląd + eksport raportu.

**Kryterium zakończenia**: dla nowego dokumentu powstaje rekord + tekst + streszczenie w panelu.

### Etap 2: Q&A z cytatami (1-2 tyg.)
- Dzielenie tekstu na fragmenty (chunking) + indeks (wektorowy).
- Chat/Q&A: odpowiedzi z cytatami i odnośnikami do źródła.
- Filtry (temat, numer uchwały, data).

**Kryterium zakończenia**: użytkownik zadaje pytanie i dostaje odpowiedź z cytatami z dokumentu.

### Etap 3: Powiązania i analiza zmian (2-3 tyg.)
- Wykrywanie odniesień do innych uchwał (regex + modele).
- Linkowanie "zmienia/uchyla".
- Raport "co się zmienia" (porównanie wersji / odniesień).

**Kryterium zakończenia**: dokument ma listę powiązań i sekcję "powiązane akty".

### Etap 4: Analiza prawna (MVP+) (2-4 tyg.)
- Baza wiedzy: podstawowe ustawy i rozporządzenia (zakres do ustalenia).
- Mechanizm "ryzyka": sygnały o przekroczeniu kompetencji / kolizji.
- Lista pytań kontrolnych dla Radnego.

**Kryterium zakończenia**: dokument ma sekcję "ryzyka" + "pytania" (z uzasadnieniem i cytatami).

### Etap 5: Raportowanie i automatyzacje (1-2 tyg.)
- Raport tygodniowy/miesięczny.
- Podsumowanie sesji (na bazie porządku obrad i dokumentów).
- Alerty (mail/telegram) o nowych dokumentach i wysokim ryzyku.

**Kryterium zakończenia**: raport generuje się automatycznie wg harmonogramu.

## 7. Ryzyka i decyzje do akceptacji
- **Źródło dokumentów**: czy system "Rada" ma API, czy robimy pobieranie po HTML.
- **Ekstrakcja treści**: multimodalny LLM, limity rozmiaru plików i kontrola kosztów.
- **LLM**: gdzie są przetwarzane dane (lokalnie/chmura), koszty i prywatność.
- **Analiza prawna**: to ma być wsparcie decyzyjne (sygnały), nie "opinia prawna".

## 8. Pytania do Ciebie (do doprecyzowania)
- Jaki jest dokładny adres/źródło dokumentów dla Drawna (BIP/system "Rada")?
- Czy agent ma działać lokalnie na Twoim komputerze/serwerze, czy w chmurze?
- Czy chcesz panel webowy jako priorytet, czy wystarczy czat (np. w panelu)?
- Który wariant integracji OpenAI wybieramy: standardowe API (publiczny endpoint) czy przez `OPENAI_BASE_URL` (proxy/gateway)?
- Jakie modele chcesz ustawić jako domyślne dla `OPENAI_MODEL` i `OPENAI_EMBEDDING_MODEL`?
