# 07 — Pakiet `@aasystent-radnego/shared` (`packages/shared`)

## Rola

`packages/shared` dostarcza współdzielony kod dla:

- `apps/api`
- `apps/worker`
- `apps/frontend` (import przez alias `@shared/*`)

Zakres obejmuje głównie:

- typy i schematy Zod (kontrakty danych)
- narzędzia integracji z OpenAI (oraz wywołania „openai-compatible”)

## Publiczny eksport

- Plik: `packages/shared/src/index.ts`

Eksportowane moduły:

- `./types/document.js`
- `./types/chat.js`
- `./types/provider.js`
- `./types/data-sources-api.js`
- `./types/deep-research.js`
- `./lib/openai.js`

## `lib/openai.ts` — utilities AI

Plik: `packages/shared/src/lib/openai.ts`

### Deterministyczne parametry

Wspólny zestaw parametrów:

- `temperature: 0`
- `top_p: 1`
- `frequency_penalty: 0`
- `presence_penalty: 0`

### Funkcje

- `createOpenAIClient(apiKey?)`
- `extractTextFromImage(client, imageBase64, mimeType)`
- `generateSummary(client, text, promptVersion?)`
- `scanForRisks(client, text, promptVersion?)`
- `generateEmbedding(client, text)`
- `chunkText(text, maxTokens?, overlap?)`
- `detectDocumentRelations(client, sourceText, targetText)`

### Modele (stałe)

- Vision: `gpt-4-vision-preview`
- LLM: `gpt-4-turbo-preview`
- Embeddings: `text-embedding-3-small`

## Typy i kontrakty

W `packages/shared/src/types/*` występują m.in.:

- dokumenty i analizy (Zod + TS)
- czat, konwersacje i prompty systemowe
- konfiguracja providerów AI
- kontrakty „Data Sources API” (typy źródeł, konfiguracje fetcherów/scraperów)
- kontrakty „Deep Research” (requesty, wyniki, reporty)

**Cel:** utrzymanie jednego źródła prawdy dla formatów danych między aplikacjami.
