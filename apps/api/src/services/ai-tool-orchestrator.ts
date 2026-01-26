/**
 * AI Tool Orchestrator - Inteligentna orchestracja narzędzi AI
 */

import OpenAI from "openai";
import { DeepResearchService } from "./deep-research-service.js";
import { LegalSearchAPI } from "./legal-search-api.js";
import { LegalReasoningEngine } from "./legal-reasoning-engine.js";
import { DocumentQueryService } from "./document-query-service.js";
import { SessionDiscoveryService } from "./session-discovery-service.js";
import { YouTubeSessionService } from "./youtube-session-service.js";
import { GUSApiService } from "./gus-api-service.js";
import { ISAPApiService } from "./isap-api-service.js";
import { EUFundsService } from "./eu-funds-service.js";
import { GeoportalService } from "./geoportal-service.js";
import { TerytService } from "./teryt-service.js";
import { KrsService } from "./krs-service.js";
import { CeidgService } from "./ceidg-service.js";
import { GdosService } from "./gdos-service.js";
import { VoiceActionService } from "./voice-action-service.js";
import { semanticDocumentSearch } from "./semantic-document-discovery.js";
import { semanticWebSearch } from "./semantic-web-search.js";
import { cascadeSearch } from "./search-cascade.js";
import { getLLMClient, getAIConfig } from "../ai/index.js";

export type ToolType =
  | "deep_research"
  | "rag_search"
  | "legal_analysis"
  | "session_search"
  | "person_search"
  | "document_fetch"
  | "budget_analysis"
  | "youtube_search"
  | "gus_statistics"
  | "isap_legal"
  | "eu_funds"
  | "geoportal_spatial"
  | "teryt_registry"
  | "krs_registry"
  | "ceidg_registry"
  | "gdos_environmental"
  | "data_sources_search"
  | "verified_web_search"
  | "exhaustive_search"
  | "voice_control"
  | "app_navigation"
  | "calendar_add"
  | "calendar_list"
  | "calendar_edit"
  | "calendar_delete"
  | "task_add"
  | "task_list"
  | "task_complete"
  | "task_delete"
  | "alert_check"
  | "quick_tool"
  | "app_navigate"
  | "simple_answer";

export interface DetectedIntent {
  primaryIntent: ToolType;
  secondaryIntents: ToolType[];
  confidence: number;
  entities: {
    personNames: string[];
    documentRefs: string[];
    sessionNumbers: number[];
    dates: string[];
    topics: string[];
  };
  requiresDeepSearch: boolean;
  estimatedTimeSeconds: number;
  userFriendlyDescription: string;
}

export interface ToolExecutionResult {
  tool: ToolType;
  success: boolean;
  data: unknown;
  executionTimeMs: number;
  message?: string;
  uiAction?: {
    type: string;
    target?: string;
    data?: unknown;
  };
  navigationTarget?: string;
  error?: string;
}

export interface OrchestratorResult {
  intent: DetectedIntent;
  toolResults: ToolExecutionResult[];
  synthesizedResponse: string;
  sources: Array<{ title: string; url?: string; type: string }>;
  totalTimeMs: number;
  warnings: string[];
}

const INTENT_DETECTION_PROMPT = `Jesteś ekspertem od analizy intencji użytkownika. Wybierz JEDNO narzędzie jako primaryIntent.

# ZASADY ROZUMOWANIA KONTEKSTOWEGO:
- Stosuj rozumowanie semantyczne, nie tylko słowa kluczowe. Jeśli użytkownik pyta o dane statystyczne, populację, bezrobocie itp. → gus_statistics, nawet gdy nie pada słowo "GUS".
- Jeśli pytanie dotyczy ochrony środowiska, obszarów chronionych, map, parceli → rozważ geoportal_spatial / gdos_environmental.
- Jeśli prosi o przepisy/akty prawne → isap_legal, nawet bez słowa "ustawa".
- Jeśli chce dane finansowe gminy/budżet → budget_analysis lub rag_search (dokumenty lokalne) w zależności od treści.
- Jeśli prosi o "wyszukaj"/"znajdź informacje" w wielu źródłach → verified_web_search lub exhaustive_search.
- Unikaj simple_answer, jeśli jakiekolwiek narzędzie może dostarczyć danych.

# NARZĘDZIA I KIEDY ICH UŻYWAĆ:

## REJESTRY PUBLICZNE (priorytet gdy wymienione wprost):
- **geoportal_spatial** → działka, parcela, MPZP, mapa, współrzędne, nieruchomość, plan zagospodarowania
- **teryt_registry** → TERYT, kod terytorialny, jednostka administracyjna, lista gmin/powiatów
- **krs_registry** → KRS, spółka, stowarzyszenie, fundacja, rejestr sądowy, podmiot prawny
- **ceidg_registry** → CEIDG, NIP, REGON, działalność gospodarcza, firma jednoosobowa
- **gdos_environmental** → GDOŚ, Natura 2000, obszar chroniony, rezerwat, park narodowy, ochrona środowiska

## DANE PUBLICZNE:
- **gus_statistics** → GUS, statystyki, ludność, demografia, dane gminy, mieszkańcy
- **isap_legal** → ustawa, rozporządzenie, akt prawny, dziennik ustaw, przepis prawa
- **eu_funds** → dotacje UE, fundusze europejskie, nabory, konkursy, dofinansowanie

## LOKALNE DOKUMENTY:
- **session_search** → sesja rady + NUMER (np. "sesja 15", "sesja nr 8")
- **rag_search** → uchwała, protokół, dokument lokalny, posiedzenie komisji, komisja budżetowa (bez numeru sesji)
- **document_fetch** → pobranie konkretnego dokumentu po numerze/referencji
- **budget_analysis** → budżet gminy, wydatki, dochody, finanse

⚠️ UWAGA: Pytania o "posiedzenie", "komisja", "committee", "relacja", "artykuł", "gazeta", "Drawnowiny" BEZ słów "utwórz/generuj/napisz" → **rag_search** (szuka dokumentów)
  - "posiedzenie komisji budżetowej" → rag_search
  - "co było na komisji" → rag_search  
  - "protokół z sesji" → rag_search (szuka istniejącego)
  - "relacja z sesji" → rag_search (szuka artykułu/relacji)
  - "Drawnowiny relacja z sesji" → rag_search (szuka w gazecie lokalnej)

## ŹRÓDŁA DANYCH:
- **data_sources_search** → "przeszukaj źródła", "scraping", "pobierz dane ze źródeł", "wyszukaj w źródłach danych", "aktualizuj dane", "synchronizuj źródła", "uruchom wyszukiwanie"

## WYSZUKIWANIE W INTERNECIE Z WERYFIKACJĄ:
- **verified_web_search** → "sprawdź w internecie", "zweryfikuj informację", "czy to prawda", "fake news", "potwierdź", "wiarygodność", "wyszukaj z weryfikacją"

## WYCZERPUJĄCE WYSZUKIWANIE KASKADOWE:
- **exhaustive_search** → "przeszukaj wszystko", "wyczerpujące wyszukiwanie", "przeszukaj wszystkie źródła", "znajdź gdziekolwiek", "szukaj wszędzie", "pełne wyszukiwanie", "sprawdź wszystkie bazy"

## SESJE RADY (bez numeru):
- **session_search** → "ostatnia sesja", "sesja grudniowa", "sesja rady", "sesja z grudnia" (gdy brak konkretnego numeru, szukaj najnowszej)

## INNE:
- **person_search** → pytanie o KONKRETNĄ OSOBĘ z imienia/nazwiska
- **youtube_search** → nagranie, wideo, transmisja, YouTube
- **deep_research** → szerokie wyszukiwanie w internecie
- **legal_analysis** → analiza prawna, interpretacja przepisów
- **simple_answer** → proste pytanie, powitanie, bez potrzeby narzędzi

## KALENDARZ I ZADANIA:
- **calendar_add** → "dodaj do kalendarza", "zaplanuj spotkanie", "wpisz wydarzenie na [data]"
- **calendar_list** → "pokaż kalendarz", "co mam zaplanowane", "jakie mam spotkania"
- **calendar_edit** → "zmień termin", "przesuń spotkanie", "zaktualizuj wydarzenie"
- **calendar_delete** → "usuń z kalendarza", "odwołaj spotkanie", "anuluj wydarzenie"
- **task_add** → "dodaj zadanie", "zanotuj do zrobienia", "przypomnij mi o"
- **task_list** → "pokaż zadania", "co mam do zrobienia", "lista zadań"
- **task_complete** → "oznacz jako zrobione", "ukończ zadanie", "zrobione"
- **task_delete** → "usuń zadanie", "wykreśl zadanie"

## ALERTY I NAWIGACJA:
- **alert_check** → "sprawdź alerty", "czy są powiadomienia", "co nowego"
- **quick_tool** → WYMAGA słów akcji: "utwórz", "napisz", "generuj", "przygotuj", "stwórz"
  Przykłady: "utwórz interpelację", "napisz pismo", "generuj protokół", "przygotuj wystąpienie"
  ⚠️ BEZ słów akcji → użyj rag_search (wyszukiwanie)
- **app_navigate** → "przejdź do pulpitu", "otwórz dokumenty", "pokaż ustawienia", "idź do czatu"

# PRZYKŁADY MAPOWANIA:

Pytanie: "znajdź działkę 123/4 w Drawnie" → geoportal_spatial
Pytanie: "sprawdź spółkę ABC sp. z o.o." → krs_registry
Pytanie: "NIP 5261234567" → ceidg_registry
Pytanie: "obszary Natura 2000 w gminie" → gdos_environmental
Pytanie: "kod TERYT gminy Drawno" → teryt_registry
Pytanie: "ile mieszkańców ma gmina" → gus_statistics
Pytanie: "ustawa o samorządzie gminnym" → isap_legal
Pytanie: "dotacje na OZE" → eu_funds
Pytanie: "co było na sesji nr 15" → session_search (sessionNumbers: [15])
Pytanie: "znajdź uchwałę o podatkach" → rag_search
Pytanie: "kim jest Jan Kowalski" → person_search (personNames: ["Jan Kowalski"])
Pytanie: "cześć, jak się masz" → simple_answer
Pytanie: "dodaj spotkanie na jutro o 10" → calendar_add
Pytanie: "co mam zaplanowane na ten tydzień" → calendar_list
Pytanie: "dodaj zadanie przygotować raport" → task_add
Pytanie: "pokaż moje zadania" → task_list

# REGUŁY PRIORYTETÓW:
1. Jeśli pytanie zawiera "TERYT" → teryt_registry
2. Jeśli pytanie zawiera "KRS" lub "spółka/stowarzyszenie/fundacja" → krs_registry
3. Jeśli pytanie zawiera "NIP"/"REGON"/"CEIDG" lub "działalność gospodarcza" → ceidg_registry
4. Jeśli pytanie zawiera "działka"/"MPZP"/"Geoportal" → geoportal_spatial
5. Jeśli pytanie zawiera "Natura 2000"/"GDOŚ"/"rezerwat"/"park narodowy" → gdos_environmental
6. Jeśli pytanie zawiera "GUS"/"statystyki"/"ludność" → gus_statistics
7. Jeśli pytanie zawiera "ustawa"/"rozporządzenie"/"ISAP" → isap_legal
8. Jeśli pytanie zawiera "dotacje"/"fundusze europejskie"/"UE" → eu_funds
9. Jeśli pytanie zawiera "sesja" + NUMER → session_search
10. Jeśli pytanie zawiera imię i nazwisko osoby → person_search

Odpowiedz TYLKO w formacie JSON:
{
  "primaryIntent": "tool_name",
  "secondaryIntents": [],
  "confidence": 0.95,
  "entities": {
    "personNames": [],
    "documentRefs": [],
    "sessionNumbers": [],
    "dates": [],
    "topics": ["główny temat zapytania"]
  },
  "requiresDeepSearch": false,
  "estimatedTimeSeconds": 10,
  "userFriendlyDescription": "Krótki opis co robię"
}`;

export class AIToolOrchestrator {
  private userId: string;
  private llmClient: OpenAI | null = null;
  private model: string = "gpt-4o-mini";

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initialize(): Promise<void> {
    if (this.llmClient) return;
    this.llmClient = await getLLMClient(this.userId);
    const config = await getAIConfig(this.userId, "llm");
    this.model = config.modelName;
  }

  async process(
    userMessage: string,
    conversationContext?: string,
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    await this.initialize();

    const intent = await this.detectIntent(userMessage, conversationContext);

    if (intent.primaryIntent === "simple_answer" && intent.confidence > 0.8) {
      return {
        intent,
        toolResults: [],
        synthesizedResponse: "",
        sources: [],
        totalTimeMs: Date.now() - startTime,
        warnings: [],
      };
    }

    const toolResults = await this.executeTools(intent, userMessage);
    const { response, sources } = await this.synthesizeResponse(
      userMessage,
      intent,
      toolResults,
    );

    return {
      intent,
      toolResults,
      synthesizedResponse: response,
      sources,
      totalTimeMs: Date.now() - startTime,
      warnings: toolResults
        .filter((r) => !r.success)
        .map((r) => `Narzędzie ${r.tool} napotkało błąd: ${r.error}`),
    };
  }

  private async detectIntent(
    userMessage: string,
    context?: string,
  ): Promise<DetectedIntent> {
    if (!this.llmClient) throw new Error("LLM client not initialized");

    try {
      const completion = await this.llmClient.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: INTENT_DETECTION_PROMPT },
          {
            role: "user",
            content: context
              ? `Kontekst:\n${context}\n\nPytanie:\n${userMessage}`
              : userMessage,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      // Usuń markdown code fence jeśli model zwrócił ```json ... ```
      let jsonContent = completion.choices[0]?.message?.content || "{}";
      jsonContent = jsonContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const result = JSON.parse(jsonContent);

      const rawSessionNumbers = result.entities?.sessionNumbers || [];
      const validSessionNumbers = rawSessionNumbers
        .map((n: unknown) => {
          if (typeof n === "number") return Math.floor(n);
          if (typeof n === "string") {
            const parsed = parseInt(n, 10);
            return isNaN(parsed) ? null : parsed;
          }
          return null;
        })
        .filter((n: number | null): n is number => n !== null && n > 0);

      return {
        primaryIntent: result.primaryIntent || "simple_answer",
        secondaryIntents: result.secondaryIntents || [],
        confidence: result.confidence || 0.5,
        entities: {
          personNames: result.entities?.personNames || [],
          documentRefs: result.entities?.documentRefs || [],
          sessionNumbers: validSessionNumbers,
          dates: result.entities?.dates || [],
          topics: result.entities?.topics || [],
        },
        requiresDeepSearch: result.requiresDeepSearch || false,
        estimatedTimeSeconds: result.estimatedTimeSeconds || 10,
        userFriendlyDescription:
          result.userFriendlyDescription || "Przetwarzanie zapytania...",
      };
    } catch (error) {
      console.error("[AIOrchestrator] Intent detection failed:", error);
      return {
        primaryIntent: "rag_search",
        secondaryIntents: [],
        confidence: 0.5,
        entities: {
          personNames: [],
          documentRefs: [],
          sessionNumbers: [],
          dates: [],
          topics: [],
        },
        requiresDeepSearch: false,
        estimatedTimeSeconds: 15,
        userFriendlyDescription: "Wyszukiwanie w dokumentach...",
      };
    }
  }

  private async executeTools(
    intent: DetectedIntent,
    userMessage: string,
  ): Promise<ToolExecutionResult[]> {
    const tools = [intent.primaryIntent, ...intent.secondaryIntents];
    const results: ToolExecutionResult[] = [];

    for (const tool of tools) {
      const startTime = Date.now();
      try {
        const rawResult = await this.executeSingleTool(
          tool,
          userMessage,
          intent,
        );

        let normalizedData: unknown = rawResult;
        let message: string | undefined;
        let uiAction: ToolExecutionResult["uiAction"];
        let navigationTarget: string | undefined;

        if (rawResult && typeof rawResult === "object") {
          const obj = rawResult as Record<string, unknown>;
          if ("message" in obj && typeof obj.message === "string") {
            message = obj.message;
          }
          if ("uiAction" in obj) {
            uiAction = obj.uiAction as ToolExecutionResult["uiAction"];
          }
          if (
            "navigationTarget" in obj &&
            typeof obj.navigationTarget === "string"
          ) {
            navigationTarget = obj.navigationTarget;
          }
          if ("data" in obj) {
            normalizedData = obj.data as unknown;
          }
        }

        results.push({
          tool,
          success: true,
          data: normalizedData,
          message,
          uiAction,
          navigationTarget,
          executionTimeMs: Date.now() - startTime,
        });

        // ZASADA OGÓLNA: Fallback do exhaustive_search dla narzędzi wyszukiwania bez wyników
        const searchTools: ToolType[] = [
          "session_search",
          "rag_search",
          "person_search",
          "document_fetch",
          "budget_analysis",
          "youtube_search",
          "data_sources_search",
        ];

        if (searchTools.includes(tool)) {
          const searchData = normalizedData as {
            results?: unknown[];
            documents?: unknown[];
            ragResults?: unknown[];
            videos?: unknown[];
            totalFound?: number;
          };

          const hasResults =
            (searchData?.results?.length || 0) > 0 ||
            (searchData?.documents?.length || 0) > 0 ||
            (searchData?.ragResults?.length || 0) > 0 ||
            (searchData?.videos?.length || 0) > 0 ||
            (searchData?.totalFound || 0) > 0;

          if (!hasResults && !tools.includes("exhaustive_search")) {
            console.log(
              `[Orchestrator] ${tool} empty, fallback to exhaustive_search`,
            );
            const cascadeStartTime = Date.now();
            try {
              const cascadeData = await this.executeSingleTool(
                "exhaustive_search",
                userMessage,
                intent,
              );
              results.push({
                tool: "exhaustive_search",
                success: true,
                data: cascadeData,
                executionTimeMs: Date.now() - cascadeStartTime,
              });
            } catch (cascadeError) {
              console.error(
                "[Orchestrator] Exhaustive search fallback failed:",
                cascadeError,
              );
            }
          }
        }
      } catch (error) {
        results.push({
          tool,
          success: false,
          data: null,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return results;
  }

  private async executeSingleTool(
    tool: ToolType,
    userMessage: string,
    intent: DetectedIntent,
  ): Promise<unknown> {
    switch (tool) {
      case "deep_research": {
        const service = new DeepResearchService(this.userId);
        return await service.research({
          query: userMessage,
          researchType: "legal",
          depth: "deep",
          maxResults: 15,
        });
      }

      case "rag_search": {
        const service = new LegalSearchAPI(this.userId);
        return await service.search({
          query: userMessage,
          searchMode: "hybrid",
          maxResults: 10,
        });
      }

      case "legal_analysis": {
        const engine = new LegalReasoningEngine(this.userId);
        return await engine.analyze({
          question: userMessage,
          analysisType: "general",
        });
      }

      case "session_search": {
        const service = new SessionDiscoveryService(this.userId);
        await service.initialize();
        const sessionNumber = intent.entities.sessionNumbers[0];

        if (!sessionNumber || sessionNumber <= 0) {
          // Brak numeru sesji - szukaj po kontekście (miesiąc, rok, "ostatnia")
          const ragService = new LegalSearchAPI(this.userId);

          // Wykryj miesiąc z pytania
          const monthPatterns: Record<string, string> = {
            stycz: "styczeń",
            luty: "luty",
            marz: "marzec",
            kwie: "kwiecień",
            maj: "maj",
            czerw: "czerwiec",
            lip: "lipiec",
            sierp: "sierpień",
            wrze: "wrzesień",
            paźdz: "październik",
            listop: "listopad",
            grud: "grudzień",
          };

          let detectedMonth = "";
          const lowerMessage = userMessage.toLowerCase();
          for (const [pattern, month] of Object.entries(monthPatterns)) {
            if (lowerMessage.includes(pattern)) {
              detectedMonth = month;
              break;
            }
          }

          // Określ rok na podstawie aktualnej daty
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;

          // "Ostatnia grudniowa" w styczniu = grudzień poprzedniego roku
          let targetYear = currentYear;
          if (detectedMonth && lowerMessage.includes("ostatni")) {
            const monthIndex =
              [
                "styczeń",
                "luty",
                "marzec",
                "kwiecień",
                "maj",
                "czerwiec",
                "lipiec",
                "sierpień",
                "wrzesień",
                "październik",
                "listopad",
                "grudzień",
              ].indexOf(detectedMonth) + 1;
            if (monthIndex > currentMonth) {
              targetYear = currentYear - 1;
            }
          }

          // Zbuduj query z kontekstem czasowym
          const searchQuery = detectedMonth
            ? `sesja rady ${detectedMonth} ${targetYear}`
            : `sesja rady ${userMessage}`;

          console.log(
            `[Session Search] No session number, searching: "${searchQuery}"`,
          );

          return await ragService.search({
            query: searchQuery,
            searchMode: "hybrid",
            maxResults: 15,
            filters: { documentTypes: ["session", "protocol", "transcript"] },
          });
        }

        return await service.discoverSession({
          sessionNumber,
          requestType: "ogolne",
          originalQuery: userMessage,
        });
      }

      case "person_search": {
        const ragService = new LegalSearchAPI(this.userId);
        const personName = intent.entities.personNames[0] || "";
        const ragResults = await ragService.search({
          query: `${personName} radny głosowanie aktywność`,
          searchMode: "hybrid",
          maxResults: 10,
        });
        if (intent.requiresDeepSearch) {
          const deepService = new DeepResearchService(this.userId);
          const deepResults = await deepService.research({
            query: `${personName} radny ${intent.entities.topics.join(" ")}`,
            researchType: "general",
            depth: "standard",
            maxResults: 10,
          });
          return { ragResults, deepResults };
        }
        return { ragResults };
      }

      case "document_fetch": {
        const service = new DocumentQueryService(this.userId);
        await service.initialize();
        const docRef = intent.entities.documentRefs[0] || userMessage;
        return await service.queryDocuments(docRef);
      }

      case "budget_analysis": {
        const service = new LegalSearchAPI(this.userId);
        return await service.search({
          query: `budżet ${intent.entities.topics.join(
            " ",
          )} ${intent.entities.dates.join(" ")}`,
          searchMode: "hybrid",
          maxResults: 15,
          filters: { documentTypes: ["budget", "resolution", "report"] },
        });
      }

      case "youtube_search": {
        const youtubeService = new YouTubeSessionService();
        await youtubeService.initializeWithUserConfig(this.userId);
        const searchResult = await youtubeService.searchWithContext(
          userMessage,
          { topics: intent.entities.topics },
        );
        return {
          videos: searchResult.sessions,
          channelName: searchResult.channelName,
          success: searchResult.success,
        };
      }

      case "gus_statistics": {
        const gusService = new GUSApiService();
        const gminaName = intent.entities.topics[0] || "";
        if (!gminaName) {
          const subjects = await gusService.getSubjects();
          return {
            type: "subjects_list",
            message: "Dostępne kategorie danych w GUS BDL:",
            subjects: subjects.slice(0, 20),
          };
        }
        let unit = await gusService.findGmina(gminaName);

        // Fallback: spróbuj województwo (level 2) gdy użytkownik podał np. "woj. mazowieckie"
        if (!unit) {
          const voivodeships = await gusService.getUnits({ level: 2 });
          unit =
            voivodeships.find((u) =>
              u.name.toLowerCase().includes(gminaName.toLowerCase()),
            ) || null;
        }

        if (!unit) {
          return {
            type: "not_found",
            message: `Nie znaleziono jednostki "${gminaName}" w bazie GUS BDL`,
            suggestion: "Podaj pełną nazwę gminy lub województwa",
          };
        }

        const stats = await gusService.getGminaStats(unit.id);
        return {
          type: "gmina_stats",
          unit: { id: unit.id, name: unit.name, level: unit.level },
          stats,
          source: "GUS Bank Danych Lokalnych",
        };
      }

      case "isap_legal": {
        const isapService = new ISAPApiService();
        const topic = intent.entities.topics[0] || userMessage;
        const acts = await isapService.searchByTitle(topic, undefined, 15);
        if (acts.length === 0) {
          const localGovActs = await isapService.searchLocalGovernmentActs(
            topic,
            15,
          );
          return {
            type: "local_government_acts",
            query: topic,
            count: localGovActs.length,
            acts: localGovActs,
            source: "ISAP",
          };
        }
        return {
          type: "search_results",
          query: topic,
          count: acts.length,
          acts,
          source: "ISAP",
        };
      }

      case "eu_funds": {
        const euService = new EUFundsService();
        const projectType = intent.entities.topics[0] || "";
        const municipality = intent.entities.topics[1] || "";
        const competitions = await euService.getActiveCompetitions();
        if (projectType) {
          const opportunities =
            await euService.findFundingOpportunities(projectType);
          return {
            type: "funding_opportunities",
            projectType,
            ...opportunities,
            source: "Portal Funduszy Europejskich",
          };
        }
        if (municipality) {
          const projects = await euService.searchProjects({
            municipality,
            limit: 20,
          });
          const summary = await euService.getProjectsSummary(municipality);
          return {
            type: "municipality_projects",
            municipality,
            projects,
            summary,
            source: "Mapa Dotacji UE",
          };
        }
        return {
          type: "active_competitions",
          count: competitions.length,
          competitions,
          source: "Portal Funduszy Europejskich",
        };
      }

      case "geoportal_spatial": {
        const geoportalService = new GeoportalService();
        const query = intent.entities.topics[0] || userMessage;

        // Sprawdź czy to współrzędne
        const coordMatch = userMessage.match(
          /(\d+[.,]\d+)\s*[,;\s]\s*(\d+[.,]\d+)/,
        );
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1].replace(",", "."));
          const lon = parseFloat(coordMatch[2].replace(",", "."));
          const parcel = await geoportalService.getParcelByCoordinates(
            lat,
            lon,
          );
          const plans = await geoportalService.getSpatialPlanInfo(lat, lon);
          return {
            type: "location_info",
            coordinates: { lat, lon },
            parcel,
            spatialPlans: plans,
            links: parcel
              ? {
                  geoportal: geoportalService.getGeoportalLink(parcel.id),
                  orthophoto: geoportalService.getOrthophotoUrl(lat, lon),
                }
              : null,
            source: "Geoportal.gov.pl",
          };
        }

        // Wyszukaj po nazwie/adresie
        const results = await geoportalService.search({
          query,
          address: query,
          municipality: query,
        });
        return {
          type: "search_results",
          query,
          parcels: results.parcels,
          addresses: results.addresses,
          municipalities: results.units,
          source: "Geoportal.gov.pl",
        };
      }

      case "teryt_registry": {
        const terytService = new TerytService();
        const query = intent.entities.topics[0] || userMessage;
        const results = await terytService.search({ query });
        return {
          type: "teryt_search",
          query,
          units: results.units,
          streets: results.streets,
          source: "TERYT GUS",
        };
      }

      case "krs_registry": {
        const krsService = new KrsService();
        const query = intent.entities.topics[0] || "";
        const nipMatch = userMessage.match(/\b\d{10}\b/);
        const krsMatch = userMessage.match(/\b\d{10}\b|KRS\s*(\d+)/i);

        if (nipMatch) {
          const entity = await krsService.getByNip(nipMatch[0]);
          return {
            type: "krs_entity",
            entity,
            searchType: "nip",
            source: "KRS",
          };
        }
        if (krsMatch) {
          const entity = await krsService.getByKrs(krsMatch[1] || krsMatch[0]);
          return {
            type: "krs_entity",
            entity,
            searchType: "krs",
            source: "KRS",
          };
        }
        const results = await krsService.search({ name: query });
        return {
          type: "krs_search",
          query,
          entities: results.entities,
          totalCount: results.totalCount,
          source: "KRS",
        };
      }

      case "ceidg_registry": {
        const ceidgService = new CeidgService();
        const query = intent.entities.topics[0] || "";
        const nipMatch = userMessage.match(/\b\d{10}\b/);

        if (nipMatch) {
          const entry = await ceidgService.getByNip(nipMatch[0]);
          return {
            type: "ceidg_entry",
            entry,
            source: "CEIDG",
          };
        }
        const results = await ceidgService.search({ name: query });
        return {
          type: "ceidg_search",
          query,
          entries: results.entries,
          totalCount: results.totalCount,
          source: "CEIDG",
        };
      }

      case "gdos_environmental": {
        const gdosService = new GdosService();
        const coordMatch = userMessage.match(
          /(\d+[.,]\d+)\s*[,;\s]\s*(\d+[.,]\d+)/,
        );

        if (coordMatch) {
          const lat = parseFloat(coordMatch[1].replace(",", "."));
          const lon = parseFloat(coordMatch[2].replace(",", "."));
          const data = await gdosService.getEnvironmentalDataAtLocation(
            lat,
            lon,
          );
          return {
            type: "environmental_data",
            location: { lat, lon },
            isInProtectedArea: data.isInProtectedArea,
            protectedAreas: data.protectedAreas,
            natura2000Sites: data.natura2000Sites,
            restrictions: data.restrictions,
            source: "GDOŚ",
          };
        }
        const query = intent.entities.topics[0] || userMessage;
        const areas = await gdosService.searchProtectedAreas({ name: query });
        return {
          type: "protected_areas_search",
          query,
          areas,
          source: "GDOŚ",
        };
      }

      case "verified_web_search": {
        // Wyszukiwanie w internecie z weryfikacją wiarygodności
        const searchQuery = intent.entities.topics[0] || userMessage;
        const result = await semanticWebSearch(this.userId, {
          query: searchQuery,
          maxResults: 10,
          minCredibility: 50,
          requireCrossReference: true,
        });
        return {
          type: "verified_web_search",
          query: searchQuery,
          success: result.success,
          results: result.results.slice(0, 8),
          summary: result.summary,
          overallConfidence: result.overallConfidence,
          warnings: result.warnings,
          reliableSourcesCount: result.reliableSourcesCount,
          sourcesAnalyzed: result.sourcesAnalyzed,
          source: "Zweryfikowane wyszukiwanie internetowe",
        };
      }

      case "data_sources_search": {
        // Przeszukaj wszystkie źródła danych użytkownika (dokumenty + API)
        const searchQuery = intent.entities.topics[0] || userMessage;

        // 1. Wyszukaj w lokalnych dokumentach (RAG)
        const ragResult = await semanticDocumentSearch(this.userId, {
          query: searchQuery,
          maxResults: 15,
          minRelevance: 0.3,
          deepCrawl: true,
          extractPDFs: true,
        });

        // 2. Wywołaj serwisy API równolegle
        const apiResults: Array<{
          source: string;
          data: unknown;
          success: boolean;
        }> = [];

        try {
          // GUS - statystyki
          const gusService = new GUSApiService();
          const gusData = await gusService.getSubjects();
          if (gusData && gusData.length > 0) {
            apiResults.push({
              source: "GUS BDL",
              data: { subjects: gusData.slice(0, 5) },
              success: true,
            });
          }
        } catch {
          /* ignore */
        }

        try {
          // ISAP - akty prawne
          const isapService = new ISAPApiService();
          const isapData = await isapService.searchByTitle(
            searchQuery,
            undefined,
            5,
          );
          if (isapData && isapData.length > 0) {
            apiResults.push({
              source: "ISAP",
              data: { acts: isapData },
              success: true,
            });
          }
        } catch {
          /* ignore */
        }

        try {
          // EU Funds - dotacje
          const euService = new EUFundsService();
          const euData = await euService.getActiveCompetitions();
          if (euData && euData.length > 0) {
            apiResults.push({
              source: "Fundusze UE",
              data: { competitions: euData.slice(0, 5) },
              success: true,
            });
          }
        } catch {
          /* ignore */
        }

        return {
          type: "data_sources_search",
          query: searchQuery,
          success: ragResult.success || apiResults.length > 0,
          totalFound:
            ragResult.totalFound +
            apiResults.reduce((sum, r) => sum + (r.success ? 1 : 0), 0),
          newDocumentsProcessed: ragResult.newDocumentsProcessed,
          documents: ragResult.documents?.slice(0, 10) || [],
          apiResults: apiResults,
          processingTimeMs: ragResult.processingTimeMs,
          source: "Źródła danych użytkownika (dokumenty + API)",
        };
      }

      case "exhaustive_search": {
        // Kaskadowe wyszukiwanie - wyczerpuje wszystkie źródła
        const searchQuery = intent.entities.topics[0] || userMessage;
        const sessionNumber = intent.entities.sessionNumbers[0];

        const cascadeResult = await cascadeSearch(this.userId, searchQuery, {
          exhaustive: true,
          maxResults: 20,
          sessionNumber,
        });

        return {
          type: "exhaustive_search",
          query: searchQuery,
          success: cascadeResult.success,
          totalResults: cascadeResult.totalResults,
          sourcesQueried: cascadeResult.sourcesQueried,
          sourcesWithResults: cascadeResult.sourcesWithResults,
          results: cascadeResult.results,
          exhausted: cascadeResult.exhausted,
          executionTimeMs: cascadeResult.executionTimeMs,
          source: "Wyczerpujące wyszukiwanie kaskadowe",
        };
      }

      case "calendar_add":
      case "calendar_list":
      case "calendar_edit":
      case "calendar_delete":
      case "task_add":
      case "task_list":
      case "task_complete":
      case "task_delete":
      case "alert_check":
      case "quick_tool":
      case "app_navigate": {
        const voiceService = new VoiceActionService(this.userId);
        const result = await voiceService.processVoiceCommand(userMessage);
        return {
          type: tool,
          success: result.success,
          message: result.message,
          data: result.data,
          uiAction: result.uiAction,
          navigationTarget: result.navigationTarget,
        };
      }

      case "simple_answer":
      default:
        return null;
    }
  }

  private async synthesizeResponse(
    userMessage: string,
    intent: DetectedIntent,
    toolResults: ToolExecutionResult[],
  ): Promise<{
    response: string;
    sources: Array<{ title: string; url?: string; type: string }>;
  }> {
    if (!this.llmClient) throw new Error("LLM client not initialized");

    const successfulResults = toolResults.filter(
      (r) =>
        r.success && ((r.data !== undefined && r.data !== null) || r.message),
    );
    if (successfulResults.length === 0) {
      return {
        response: "Przepraszam, nie udało się znaleźć odpowiednich informacji.",
        sources: [],
      };
    }

    // Jeśli to akcja (kalendarz/zadania/nawigacja) z komunikatem, zwróć go bez dalszej syntezy
    for (const result of successfulResults) {
      if (
        result.message &&
        [
          "calendar_add",
          "calendar_list",
          "calendar_edit",
          "calendar_delete",
          "task_add",
          "task_list",
          "task_complete",
          "task_delete",
          "alert_check",
          "quick_tool",
          "app_navigate",
        ].includes(result.tool)
      ) {
        return { response: result.message, sources: [] };
      }
    }

    const sources: Array<{ title: string; url?: string; type: string }> = [];
    let contextForSynthesis = "";

    for (const result of successfulResults) {
      const data = result.data as Record<string, unknown>;

      if (result.tool === "deep_research" && data?.results) {
        const results = data.results as Array<{
          title: string;
          url: string;
          content: string;
        }>;
        for (const r of results.slice(0, 5)) {
          sources.push({ title: r.title, url: r.url, type: "internet" });
          contextForSynthesis += `\n[Źródło: ${
            r.title
          }]\n${r.content?.substring(0, 1000)}\n`;
        }
      }

      if (result.tool === "rag_search" && Array.isArray(data)) {
        for (const doc of (
          data as Array<{ title: string; sourceUrl?: string; content: string }>
        ).slice(0, 5)) {
          sources.push({
            title: doc.title,
            url: doc.sourceUrl,
            type: "dokument lokalny",
          });
          contextForSynthesis += `\n[Dokument: ${
            doc.title
          }]\n${doc.content?.substring(0, 1000)}\n`;
        }
      }

      if (result.tool === "youtube_search") {
        const youtubeData = data as {
          videos?: Array<{ title: string; url: string }>;
          channelName?: string;
        };
        if (youtubeData.videos && youtubeData.videos.length > 0) {
          contextForSynthesis += `\n📺 WYNIKI YOUTUBE:\n`;
          for (const video of youtubeData.videos.slice(0, 10)) {
            sources.push({
              title: video.title,
              url: video.url,
              type: "YouTube",
            });
            contextForSynthesis += `- ${video.title}\n  URL: ${video.url}\n`;
          }
        }
      }

      if (result.tool === "gus_statistics") {
        const gusData = data as {
          type?: string;
          unit?: { name: string };
          stats?: {
            variables?: Array<{
              name: string;
              value: number;
              unit: string;
              year: number;
            }>;
          };
        };
        if (gusData.type === "gmina_stats" && gusData.unit && gusData.stats) {
          contextForSynthesis += `\n📊 STATYSTYKI GUS - ${gusData.unit.name}:\n`;
          sources.push({
            title: `GUS BDL: ${gusData.unit.name}`,
            url: "https://bdl.stat.gov.pl",
            type: "GUS",
          });
          if (gusData.stats.variables) {
            for (const v of gusData.stats.variables) {
              contextForSynthesis += `- ${v.name}: ${v.value.toLocaleString(
                "pl-PL",
              )} ${v.unit} (${v.year})\n`;
            }
          }
        }
      }

      if (result.tool === "isap_legal") {
        const isapData = data as {
          acts?: Array<{
            ELI: string;
            title: string;
            displayAddress: string;
            status: string;
            promulgation: string;
            type: string;
          }>;
          count?: number;
        };
        if (isapData.acts && isapData.acts.length > 0) {
          contextForSynthesis += `\n⚖️ AKTY PRAWNE Z ISAP (${isapData.count} wyników):\n`;
          for (const act of isapData.acts.slice(0, 10)) {
            sources.push({
              title: act.title.substring(0, 80),
              url: `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=${act.ELI}`,
              type: "ISAP",
            });
            contextForSynthesis += `- ${act.displayAddress} (${
              act.type
            })\n  ${act.title.substring(0, 150)}...\n  Status: ${act.status}\n`;
          }
        }
      }

      if (result.tool === "eu_funds") {
        const euData = data as {
          type?: string;
          competitions?: Array<{
            title: string;
            program: string;
            budget: number;
            endDate: string;
            url: string;
          }>;
        };
        if (euData.type === "active_competitions" && euData.competitions) {
          contextForSynthesis += `\n🇪🇺 AKTUALNE KONKURSY UE:\n`;
          for (const comp of euData.competitions.slice(0, 5)) {
            sources.push({
              title: comp.title,
              url: comp.url,
              type: "Fundusze UE",
            });
            contextForSynthesis += `- ${comp.title}\n  Program: ${
              comp.program
            }\n  Budżet: ${comp.budget.toLocaleString(
              "pl-PL",
            )} PLN\n  Termin: ${comp.endDate}\n`;
          }
        }
      }

      if (result.tool === "data_sources_search") {
        const dsData = data as {
          type?: string;
          query?: string;
          success?: boolean;
          totalFound?: number;
          newDocumentsProcessed?: number;
          documents?: Array<{
            id: string;
            title: string;
            content?: string;
            sourceUrl?: string;
            documentType?: string;
            relevanceScore?: number;
          }>;
          apiResults?: Array<{
            source: string;
            data: unknown;
            success: boolean;
          }>;
        };

        // Dokumenty lokalne (RAG)
        if (dsData.documents && dsData.documents.length > 0) {
          contextForSynthesis += `\n📚 DOKUMENTY LOKALNE (${dsData.documents.length} znalezionych):\n`;
          for (const doc of dsData.documents.slice(0, 10)) {
            sources.push({
              title: doc.title,
              url: doc.sourceUrl,
              type: doc.documentType || "dokument",
            });
            contextForSynthesis += `- ${doc.title}${doc.relevanceScore ? ` (trafność: ${Math.round(doc.relevanceScore * 100)}%)` : ""}\n`;
            if (doc.content) {
              contextForSynthesis += `  ${doc.content.substring(0, 300)}...\n`;
            }
          }
        }

        // Wyniki z API
        if (dsData.apiResults && dsData.apiResults.length > 0) {
          contextForSynthesis += `\n🔌 DANE Z SERWISÓW API:\n`;
          for (const apiResult of dsData.apiResults) {
            if (!apiResult.success) continue;

            sources.push({
              title: `${apiResult.source}`,
              type: "API",
            });

            const apiData = apiResult.data as Record<string, unknown>;

            if (apiResult.source === "ISAP" && apiData.acts) {
              const acts = apiData.acts as Array<{
                title: string;
                displayAddress?: string;
              }>;
              contextForSynthesis += `\n⚖️ ISAP - Akty prawne (${acts.length}):\n`;
              for (const act of acts.slice(0, 5)) {
                contextForSynthesis += `- ${act.displayAddress || ""}: ${act.title?.substring(0, 100)}...\n`;
              }
            }

            if (apiResult.source === "Fundusze UE" && apiData.competitions) {
              const comps = apiData.competitions as Array<{
                title: string;
                program?: string;
              }>;
              contextForSynthesis += `\n🇪🇺 Fundusze UE - Konkursy (${comps.length}):\n`;
              for (const comp of comps.slice(0, 5)) {
                contextForSynthesis += `- ${comp.title} (${comp.program || ""})\n`;
              }
            }

            if (apiResult.source === "GUS BDL" && apiData.subjects) {
              const subjects = apiData.subjects as Array<{ name: string }>;
              contextForSynthesis += `\n📊 GUS BDL - Dostępne kategorie (${subjects.length}):\n`;
              for (const subj of subjects.slice(0, 5)) {
                contextForSynthesis += `- ${subj.name}\n`;
              }
            }
          }
        }

        if (!dsData.documents?.length && !dsData.apiResults?.length) {
          contextForSynthesis += `\n📚 ŹRÓDŁA DANYCH: Nie znaleziono wyników dla zapytania "${dsData.query}".\n`;
        }
      }

      if (result.tool === "verified_web_search") {
        const webData = data as {
          type?: string;
          query?: string;
          success?: boolean;
          results?: Array<{
            title: string;
            url: string;
            snippet?: string;
            weightedScore: number;
            isReliable: boolean;
            warnings: string[];
            credibility: {
              overall: number;
              domainTrust: number;
              biasLevel: number;
              flags: Array<{ type: string; reason: string }>;
            };
          }>;
          summary?: string;
          overallConfidence?: number;
          warnings?: string[];
          reliableSourcesCount?: number;
        };

        if (webData.success && webData.results && webData.results.length > 0) {
          contextForSynthesis += `\n🔍 ZWERYFIKOWANE WYSZUKIWANIE (pewność: ${webData.overallConfidence}%, wiarygodnych źródeł: ${webData.reliableSourcesCount}):\n`;

          if (webData.summary) {
            contextForSynthesis += `\n📝 Podsumowanie: ${webData.summary}\n`;
          }

          contextForSynthesis += `\n📰 Źródła:\n`;
          for (const res of webData.results.slice(0, 6)) {
            const reliableIcon = res.isReliable ? "✅" : "⚠️";
            sources.push({
              title: res.title,
              url: res.url,
              type: res.isReliable
                ? "Zweryfikowane źródło"
                : "Wymaga weryfikacji",
            });
            contextForSynthesis += `${reliableIcon} ${res.title} (wiarygodność: ${res.weightedScore}%)\n`;
            if (res.snippet) {
              contextForSynthesis += `   ${res.snippet.substring(0, 200)}...\n`;
            }
            if (res.warnings.length > 0) {
              contextForSynthesis += `   ⚠️ ${res.warnings.join(", ")}\n`;
            }
          }

          if (webData.warnings && webData.warnings.length > 0) {
            contextForSynthesis += `\n⚠️ OSTRZEŻENIA:\n`;
            for (const warning of webData.warnings) {
              contextForSynthesis += `- ${warning}\n`;
            }
          }
        } else {
          contextForSynthesis += `\n🔍 WYSZUKIWANIE: Nie znaleziono wiarygodnych źródeł dla "${webData.query}".\n`;
        }
      }

      if (result.tool === "exhaustive_search") {
        const cascadeData = data as {
          type?: string;
          query?: string;
          success?: boolean;
          totalResults?: number;
          sourcesQueried?: string[];
          sourcesWithResults?: string[];
          results?: Array<{
            title: string;
            content: string;
            url?: string;
            relevance: number;
            sourceType: string;
            credibility?: number;
          }>;
          exhausted?: boolean;
        };

        if (
          cascadeData.success &&
          cascadeData.results &&
          cascadeData.results.length > 0
        ) {
          contextForSynthesis += `\n🔎 WYCZERPUJĄCE WYSZUKIWANIE KASKADOWE:\n`;
          contextForSynthesis += `Przeszukane źródła: ${cascadeData.sourcesQueried?.join(", ") || "nieznane"}\n`;
          contextForSynthesis += `Źródła z wynikami: ${cascadeData.sourcesWithResults?.join(", ") || "nieznane"}\n`;
          contextForSynthesis += `Znaleziono wyników: ${cascadeData.totalResults}\n\n`;

          for (const r of cascadeData.results.slice(0, 10)) {
            sources.push({
              title: r.title,
              url: r.url,
              type: r.sourceType,
            });
            contextForSynthesis += `[${r.sourceType.toUpperCase()}] ${r.title}\n`;
            contextForSynthesis += `${r.content.substring(0, 400)}...\n`;
            if (r.credibility) {
              contextForSynthesis += `(Wiarygodność: ${r.credibility}%)\n`;
            }
            contextForSynthesis += "\n";
          }
        } else {
          contextForSynthesis += `\n🔎 WYCZERPUJĄCE WYSZUKIWANIE: Nie znaleziono wyników mimo przeszukania wszystkich źródeł (${cascadeData.sourcesQueried?.join(", ") || "wszystkich"}).\n`;
        }
      }

      if (result.tool === "geoportal_spatial") {
        const geoData = data as {
          type?: string;
          query?: string;
          parcels?: Array<{
            id: string;
            voivodeship: string;
            county: string;
            municipality: string;
            precinct: string;
            parcelNumber: string;
            area?: number;
          }>;
          addresses?: Array<{
            id: string;
            street?: string;
            houseNumber?: string;
            city: string;
            voivodeship: string;
            coordinates?: { lat: number; lon: number };
          }>;
          municipalities?: Array<{
            id: string;
            name: string;
            code: string;
            type: string;
          }>;
          coordinates?: { lat: number; lon: number };
          parcel?: Record<string, unknown>;
          spatialPlans?: Array<{ name: string; type: string; status: string }>;
          links?: { geoportal?: string; orthophoto?: string };
        };

        contextForSynthesis += `\n🗺️ DANE Z GEOPORTAL.GOV.PL:\n`;
        sources.push({
          title: "Geoportal - dane przestrzenne",
          url: "https://geoportal.gov.pl",
          type: "Geoportal",
        });

        if (geoData.parcels && geoData.parcels.length > 0) {
          contextForSynthesis += `\n📍 DZIAŁKI (${geoData.parcels.length}):\n`;
          for (const p of geoData.parcels.slice(0, 10)) {
            contextForSynthesis += `- Działka ${p.parcelNumber}, obręb ${p.precinct}\n`;
            contextForSynthesis += `  Gmina: ${p.municipality}, Powiat: ${p.county}, Woj.: ${p.voivodeship}\n`;
            if (p.area) contextForSynthesis += `  Powierzchnia: ${p.area} m²\n`;
          }
        }

        if (geoData.addresses && geoData.addresses.length > 0) {
          contextForSynthesis += `\n📫 ADRESY (${geoData.addresses.length}):\n`;
          for (const a of geoData.addresses.slice(0, 10)) {
            contextForSynthesis += `- ${a.street || ""} ${a.houseNumber || ""}, ${a.city}, ${a.voivodeship}\n`;
            if (a.coordinates) {
              contextForSynthesis += `  Współrzędne: ${a.coordinates.lat}, ${a.coordinates.lon}\n`;
            }
          }
        }

        if (geoData.municipalities && geoData.municipalities.length > 0) {
          contextForSynthesis += `\n🏛️ JEDNOSTKI ADMINISTRACYJNE (${geoData.municipalities.length}):\n`;
          for (const m of geoData.municipalities.slice(0, 10)) {
            contextForSynthesis += `- ${m.name} (${m.type}), kod: ${m.code}\n`;
          }
        }

        if (geoData.spatialPlans && geoData.spatialPlans.length > 0) {
          contextForSynthesis += `\n📋 PLANY ZAGOSPODAROWANIA:\n`;
          for (const plan of geoData.spatialPlans.slice(0, 5)) {
            contextForSynthesis += `- ${plan.name} (${plan.type}) - ${plan.status}\n`;
          }
        }

        if (geoData.links?.geoportal) {
          contextForSynthesis += `\n🔗 Link do mapy: ${geoData.links.geoportal}\n`;
        }
      }

      if (
        result.tool === "calendar_add" ||
        result.tool === "calendar_list" ||
        result.tool === "calendar_edit" ||
        result.tool === "calendar_delete" ||
        result.tool === "task_add" ||
        result.tool === "task_list" ||
        result.tool === "task_complete" ||
        result.tool === "task_delete" ||
        result.tool === "alert_check" ||
        result.tool === "quick_tool" ||
        result.tool === "app_navigate"
      ) {
        // Dla akcji głosowych, message jest w result.message, nie w data.message
        const actionMessage = (result as { message?: string }).message;
        if (actionMessage) {
          return {
            response: actionMessage,
            sources: [],
          };
        }
      }
    }

    const synthesisPrompt = `Na podstawie zebranych informacji, udziel odpowiedzi na pytanie użytkownika.

PYTANIE: ${userMessage}

ZEBRANE INFORMACJE:
${contextForSynthesis.substring(0, 12000)}

Odpowiedz konkretnie i rzeczowo. Formatuj odpowiedź czytelnie.`;

    const completion = await this.llmClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "Jesteś asystentem radnego miejskiego. Tworzysz precyzyjne odpowiedzi na podstawie dostarczonych źródeł.",
        },
        { role: "user", content: synthesisPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return { response: completion.choices[0]?.message?.content || "", sources };
  }
}

export function shouldUseOrchestrator(message: string): boolean {
  const triggers = [
    /pobierz.*dane/i,
    /wyszukaj.*informacje/i,
    /wyszukaj.*sesj/i,
    /znajd[źż].*o\s/i,
    /znajd[źż].*sesj/i,
    /przeanalizuj/i,
    /sprawd[źż]/i,
    /co\s+wiadomo\s+o/i,
    /kto\s+to\s+jest/i,
    /jakie\s+są\s+dane/i,
    /pełn[ae]\s+informacj/i,
    /sesj[aię]\s+(nr|numer)?\s*\d/i,
    /ostatni[aąeę].*sesj/i,
    /sesj[aię].*grudni|sesj[aię].*stycz|sesj[aię].*luty|sesj[aię].*marz|sesj[aię].*kwie|sesj[aię].*maj|sesj[aię].*czerw|sesj[aię].*lip|sesj[aię].*sierp|sesj[aię].*wrze[sś]|sesj[aię].*pa[zź]dzier|sesj[aię].*listopa/i,
    /sesj[aię].*rady/i,
    /uchwał[aęy]/i,
    /budżet/i,
    /radny|radnego|radnej/i,
    /nagran|nagranie|wideo|video|youtube/i,
    /obejrz|transmisj|film.*sesj/i,
    /statystyk|demograficzn|ludno[śs][ćc]|mieszka[ńn]c/i,
    /gus|g\.u\.s\./i,
    /ustaw[aęy]|rozporz[aą]dzeni|akt.*prawn/i,
    /dziennik\s*ustaw|monitor\s*polski|isap/i,
    /fundusz[eóy].*europejsk|dotacj[eai].*uni|ue\s+fund/i,
    /nabor[yó]|konkurs[yó].*ue|dofinansowani/i,
    /działk[aęi]|parcela|nieruchomo[śs][ćc]/i,
    /geoportal|mapa.*dział|mpzp|plan.*zagospodarowania/i,
    /współrzędn|lokalizacj|adres.*dział/i,
    /gmina.*granice|jednostka.*administracyjna/i,
    /teryt|kod.*terytorialn|rejestr.*jednostek/i,
    /krs|krajow.*rejestr.*sądow|spółk[aię]|stowarzysze/i,
    /ceidg|działalno[śs][ćc].*gospodarcz|jednoosobow/i,
    /nip\s*\d|regon\s*\d|firma.*numer/i,
    /gdoś|natura.*2000|obszar.*chronion|rezerwat|park.*narodow/i,
    /ochrona.*środowisk|środowisko.*ograniczeni/i,
    /dodaj.*kalendarz|zaplanuj.*spotkanie|wpisz.*wydarzenie/i,
    /pokaż.*kalendarz|co.*zaplanowane|jakie.*spotkania/i,
    /zmień.*termin|przesuń.*spotkanie|usuń.*kalend|odwołaj.*spotkanie/i,
    /dodaj.*zadanie|zanotuj.*zrobienia|przypomnij.*o/i,
    /pokaż.*zadania|co.*do.*zrobienia|lista.*zadań/i,
    /oznacz.*zrobione|ukończ.*zadanie|usuń.*zadanie/i,
    /sprawdź.*alert|powiadomieni|co.*nowego/i,
    /utwórz.*interpelacj|napisz.*pismo|generuj.*protokół/i,
    /przejdź.*do|otwórz.*stron|pokaż.*pulpit|idź.*do/i,
    /przeszukaj.*źród|wyszukaj.*źród|scraping|pobierz.*ze.*źród|aktualizuj.*dane|synchronizuj.*źród/i,
    /uruchom.*wyszukiwanie|uruchom.*scraping/i,
    /zweryfikuj.*informacj|czy.*to.*prawda|fake.*news|potwierd[źż]|wiarygodno[śs][ćc]/i,
    /sprawd[źż].*w.*internecie|wyszukaj.*z.*weryfikacj/i,
    /przeszukaj.*wszystk|wyczerpuj[aą]c.*wyszukiwan|szukaj.*wszędzie|pełn.*wyszukiwan|sprawdź.*wszystkie.*baz/i,
  ];
  return triggers.some((pattern) => pattern.test(message));
}

export const AVAILABLE_TOOLS = {
  deep_research: {
    name: "Deep Research",
    description: "Głębokie wyszukiwanie w internecie",
    avgTimeSeconds: 30,
  },
  rag_search: {
    name: "RAG Search",
    description: "Wyszukiwanie w lokalnej bazie dokumentów",
    avgTimeSeconds: 5,
  },
  legal_analysis: {
    name: "Legal Reasoning Engine",
    description: "Analiza prawna",
    avgTimeSeconds: 20,
  },
  session_search: {
    name: "Session Discovery",
    description: "Wyszukiwanie materiałów z sesji rady",
    avgTimeSeconds: 10,
  },
  person_search: {
    name: "Person Search",
    description: "Wyszukiwanie informacji o osobach",
    avgTimeSeconds: 25,
  },
  document_fetch: {
    name: "Document Query",
    description: "Pobranie konkretnego dokumentu",
    avgTimeSeconds: 5,
  },
  budget_analysis: {
    name: "Budget Analysis",
    description: "Analiza budżetowa gminy",
    avgTimeSeconds: 15,
  },
  gus_statistics: {
    name: "GUS Statistics",
    description: "Statystyki z GUS BDL",
    avgTimeSeconds: 10,
  },
  isap_legal: {
    name: "ISAP Legal Acts",
    description: "Akty prawne z ISAP",
    avgTimeSeconds: 8,
  },
  eu_funds: {
    name: "EU Funds",
    description: "Fundusze europejskie - projekty, konkursy, nabory",
    avgTimeSeconds: 12,
  },
  geoportal_spatial: {
    name: "Geoportal",
    description: "Dane przestrzenne - działki, MPZP, granice administracyjne",
    avgTimeSeconds: 8,
  },
  teryt_registry: {
    name: "TERYT",
    description:
      "Rejestr jednostek terytorialnych - gminy, powiaty, województwa",
    avgTimeSeconds: 5,
  },
  krs_registry: {
    name: "KRS",
    description: "Krajowy Rejestr Sądowy - spółki, stowarzyszenia, fundacje",
    avgTimeSeconds: 10,
  },
  ceidg_registry: {
    name: "CEIDG",
    description: "Centralna Ewidencja Działalności Gospodarczej",
    avgTimeSeconds: 8,
  },
  gdos_environmental: {
    name: "GDOŚ",
    description: "Dane środowiskowe - obszary chronione, Natura 2000",
    avgTimeSeconds: 10,
  },
  calendar_add: {
    name: "Dodaj do kalendarza",
    description: "Dodawanie wydarzeń do kalendarza",
    avgTimeSeconds: 3,
  },
  calendar_list: {
    name: "Pokaż kalendarz",
    description: "Wyświetlanie zaplanowanych wydarzeń",
    avgTimeSeconds: 2,
  },
  task_add: {
    name: "Dodaj zadanie",
    description: "Tworzenie nowych zadań",
    avgTimeSeconds: 3,
  },
  task_list: {
    name: "Pokaż zadania",
    description: "Lista zadań do wykonania",
    avgTimeSeconds: 2,
  },
  calendar_edit: {
    name: "Edytuj wydarzenie",
    description: "Zmiana terminu lub szczegółów wydarzenia",
    avgTimeSeconds: 3,
  },
  calendar_delete: {
    name: "Usuń wydarzenie",
    description: "Usuwanie wydarzeń z kalendarza",
    avgTimeSeconds: 2,
  },
  task_complete: {
    name: "Ukończ zadanie",
    description: "Oznaczanie zadań jako wykonane",
    avgTimeSeconds: 2,
  },
  task_delete: {
    name: "Usuń zadanie",
    description: "Usuwanie zadań z listy",
    avgTimeSeconds: 2,
  },
  alert_check: {
    name: "Sprawdź alerty",
    description: "Sprawdzanie powiadomień i alertów",
    avgTimeSeconds: 2,
  },
  quick_tool: {
    name: "Szybkie narzędzia",
    description: "Interpelacje, pisma, protokoły, analizy budżetu",
    avgTimeSeconds: 5,
  },
  app_navigate: {
    name: "Nawigacja",
    description: "Przechodzenie między stronami aplikacji",
    avgTimeSeconds: 1,
  },
};
