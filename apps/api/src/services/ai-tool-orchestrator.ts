/**
 * AI Tool Orchestrator - Inteligentna orchestracja narzędzi AI
 *
 * System rozpoznaje intencje użytkownika i automatycznie wybiera oraz
 * uruchamia odpowiednie narzędzia do realizacji zadania.
 *
 * Dostępne narzędzia:
 * 1. DeepResearchService - głębokie wyszukiwanie w internecie
 * 2. LegalSearchAPI - wyszukiwanie w dokumentach prawnych (RAG)
 * 3. LegalReasoningEngine - analiza prawna z wykrywaniem ryzyk
 * 4. DocumentQueryService - wykrywanie i wyszukiwanie dokumentów
 * 5. SessionDiscoveryService - wyszukiwanie materiałów z sesji rady
 * 6. DocumentProcessor - przetwarzanie dokumentów PDF/HTML
 * 7. IntelligentScraper - zaawansowany scraping stron
 */

import OpenAI from "openai";
import { DeepResearchService } from "./deep-research-service.js";
import { LegalSearchAPI } from "./legal-search-api.js";
import { LegalReasoningEngine } from "./legal-reasoning-engine.js";
import { DocumentQueryService } from "./document-query-service.js";
import { SessionDiscoveryService } from "./session-discovery-service.js";
import { YouTubeSessionService } from "./youtube-session-service.js";
import { getLLMClient, getAIConfig } from "../ai/index.js";

// ============================================================================
// TYPES
// ============================================================================

export type ToolType =
  | "deep_research" // Głębokie wyszukiwanie w internecie
  | "rag_search" // Wyszukiwanie w lokalnej bazie dokumentów
  | "legal_analysis" // Analiza prawna
  | "session_search" // Wyszukiwanie materiałów z sesji
  | "person_search" // Wyszukiwanie informacji o osobach
  | "document_fetch" // Pobranie konkretnego dokumentu
  | "budget_analysis" // Analiza budżetowa
  | "youtube_search" // Wyszukiwanie nagrań sesji na YouTube
  | "simple_answer"; // Prosta odpowiedź bez narzędzi

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

// ============================================================================
// INTENT DETECTION PROMPT
// ============================================================================

const INTENT_DETECTION_PROMPT = `Jesteś ekspertem od analizy intencji użytkownika w kontekście pracy radnego miejskiego/gminnego.

Twoje zadanie: Przeanalizuj pytanie użytkownika i określ jakie narzędzia są potrzebne do udzielenia pełnej odpowiedzi.

DOSTĘPNE NARZĘDZIA (wybierz primaryIntent z tej listy):

1. **person_search** - Wyszukiwanie informacji o OSOBACH
   → UŻYJ GDY: pytanie zawiera imię/nazwisko, dotyczy radnego, burmistrza, wójta, urzędnika
   → Przykłady: "pobierz dane o radnym Nowak", "kto to jest Jan Kowalski", "informacje o przewodniczącym"
   
2. **deep_research** - Głębokie wyszukiwanie w internecie
   → Użyj gdy: pytanie wymaga aktualnych informacji z internetu, danych zewnętrznych
   
3. **rag_search** - Wyszukiwanie w lokalnej bazie dokumentów
   → Użyj gdy: pytanie dotyczy lokalnych uchwał, protokołów, dokumentów gminy (bez konkretnej osoby)
   
4. **legal_analysis** - Analiza prawna
   → Użyj gdy: pytanie dotyczy zgodności z prawem, interpretacji przepisów
   
5. **session_search** - Wyszukiwanie materiałów z sesji rady
   → Użyj gdy: pytanie WYRAŹNIE dotyczy konkretnej SESJI z NUMEREM (np. "sesja nr 14")
   
6. **document_fetch** - Pobranie konkretnego dokumentu
   → Użyj gdy: użytkownik pyta o konkretny dokument PO NUMERZE (np. "uchwała nr 123")
   
7. **budget_analysis** - Analiza budżetowa
   → Użyj gdy: pytanie dotyczy budżetu, wydatków, dochodów gminy

8. **youtube_search** - Wyszukiwanie materiałów wideo na YouTube
   → Użyj gdy: pytanie dotyczy nagrań wideo, transmisji, YouTube, materiałów audiowizualnych
   → Przykłady: "znajdź nagranie sesji", "gdzie mogę obejrzeć obrady", "transmisja z sesji", 
     "wideo o budżecie", "nagranie z konferencji", "film o inwestycji"
   → Obsługuje: sesje rady, konferencje prasowe, prezentacje, materiały edukacyjne, wywiady
   
9. **simple_answer** - Prosta odpowiedź bez narzędzi
   → Użyj TYLKO gdy pytanie jest bardzo proste i ogólne

WAŻNE ZASADY:
- Jeśli pytanie zawiera IMIĘ lub NAZWISKO osoby → primaryIntent = "person_search"
- Słowa "radny", "radnego", "radnej", "burmistrz" → person_search
- "pobierz dane o..." + osoba → person_search + deep_research
- Ustaw requiresDeepSearch=true dla pytań o pełne informacje o osobie
- Wyodrębnij wszystkie encje: imiona i nazwiska do personNames
- sessionNumbers MUSZĄ być liczbami całkowitymi (np. [14, 15]), NIE stringami!
- Jeśli numer sesji jest w formacie rzymskim (XIV, XV) - przekonwertuj na arabski
- Jeśli brak konkretnego numeru sesji, zostaw sessionNumbers jako pustą tablicę []

PARSOWANIE NUMERÓW SESJI:
- "sesja nr 14" → sessionNumbers: [14]
- "sesja XIV" → sessionNumbers: [14]
- "sesja nr XVII" → sessionNumbers: [17]
- "ostatnia sesja" → sessionNumbers: [] (brak konkretnego numeru)
- "sesje 10-15" → sessionNumbers: [10, 11, 12, 13, 14, 15]

Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "primaryIntent": "person_search",
  "secondaryIntents": ["deep_research", "rag_search"],
  "confidence": 0.95,
  "entities": {
    "personNames": ["Sławomir Nowak"],
    "documentRefs": [],
    "sessionNumbers": [],
    "dates": [],
    "topics": ["radny", "aktywność"]
  },
  "requiresDeepSearch": true,
  "estimatedTimeSeconds": 45,
  "userFriendlyDescription": "Wyszukiwanie informacji o radnym Sławomirze Nowaku"
}`;

// ============================================================================
// AI TOOL ORCHESTRATOR CLASS
// ============================================================================

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

    console.log(`[AIOrchestrator] Initialized: model=${this.model}`);
  }

  /**
   * Główna metoda - wykryj intencję i wykonaj odpowiednie narzędzia
   */
  async process(
    userMessage: string,
    conversationContext?: string
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    await this.initialize();

    console.log(
      `[AIOrchestrator] Processing: "${userMessage.substring(0, 100)}..."`
    );

    // 1. Wykryj intencję
    const intent = await this.detectIntent(userMessage, conversationContext);
    console.log(
      `[AIOrchestrator] Detected intent: ${intent.primaryIntent} (confidence: ${intent.confidence})`
    );
    console.log(
      `[AIOrchestrator] Secondary intents: ${intent.secondaryIntents.join(
        ", "
      )}`
    );
    console.log(
      `[AIOrchestrator] Entities: persons=${intent.entities.personNames.join(
        ","
      )}, topics=${intent.entities.topics.join(",")}`
    );
    console.log(
      `[AIOrchestrator] RequiresDeepSearch: ${intent.requiresDeepSearch}`
    );

    // 2. Jeśli prosta odpowiedź - zwróć bez narzędzi
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

    // 3. Wykonaj narzędzia
    const toolResults = await this.executeTools(intent, userMessage);

    // 4. Syntezuj odpowiedź
    const { response, sources } = await this.synthesizeResponse(
      userMessage,
      intent,
      toolResults
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

  /**
   * Wykryj intencję użytkownika za pomocą LLM
   */
  private async detectIntent(
    userMessage: string,
    context?: string
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
              ? `Kontekst rozmowy:\n${context}\n\nPytanie użytkownika:\n${userMessage}`
              : userMessage,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(
        completion.choices[0]?.message?.content || "{}"
      );

      // Walidacja i normalizacja sessionNumbers - muszą być liczbami całkowitymi
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

  /**
   * Wykonaj wybrane narzędzia
   */
  private async executeTools(
    intent: DetectedIntent,
    userMessage: string
  ): Promise<ToolExecutionResult[]> {
    const tools = [intent.primaryIntent, ...intent.secondaryIntents];
    const results: ToolExecutionResult[] = [];

    for (const tool of tools) {
      const startTime = Date.now();
      try {
        const data = await this.executeSingleTool(tool, userMessage, intent);
        results.push({
          tool,
          success: true,
          data,
          executionTimeMs: Date.now() - startTime,
        });
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

  /**
   * Wykonaj pojedyncze narzędzie
   */
  private async executeSingleTool(
    tool: ToolType,
    userMessage: string,
    intent: DetectedIntent
  ): Promise<unknown> {
    console.log(`[AIOrchestrator] Executing tool: ${tool}`);

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
          analysisType: "compliance",
          context: userMessage,
          documents: [],
        });
      }

      case "session_search": {
        const service = new SessionDiscoveryService(this.userId);
        await service.initialize();
        const sessionNumber = intent.entities.sessionNumbers[0];

        // Jeśli brak konkretnego numeru sesji, fallback do RAG search
        if (!sessionNumber || sessionNumber <= 0) {
          console.log(
            "[AIOrchestrator] No valid session number, falling back to RAG search"
          );
          const ragService = new LegalSearchAPI(this.userId);
          return await ragService.search({
            query: `sesja rady ${userMessage}`,
            searchMode: "hybrid",
            maxResults: 10,
            filters: {
              documentTypes: ["session", "protocol", "transcript"],
            },
          });
        }

        // Sprawdź dostępność transkrypcji YouTube dla tej sesji
        const transcriptionCheck =
          await this.checkYouTubeTranscriptionAvailability(sessionNumber);

        // Wykonaj standardowe wyszukiwanie sesji
        const sessionResult = await service.discoverSession({
          sessionNumber,
          requestType: "ogolne",
          originalQuery: userMessage,
        });

        // Dodaj informacje o transkrypcji do wyniku
        return {
          ...sessionResult,
          youtubeTranscription: transcriptionCheck,
        };
      }

      case "person_search": {
        // Kombinacja RAG + DeepResearch dla osób
        const ragService = new LegalSearchAPI(this.userId);
        const personName = intent.entities.personNames[0] || "";

        const ragResults = await ragService.search({
          query: `${personName} radny głosowanie aktywność`,
          searchMode: "hybrid",
          maxResults: 10,
        });

        // Opcjonalnie DeepResearch
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
        // RAG search z fokusem na budżet
        const service = new LegalSearchAPI(this.userId);
        return await service.search({
          query: `budżet ${intent.entities.topics.join(
            " "
          )} ${intent.entities.dates.join(" ")}`,
          searchMode: "hybrid",
          maxResults: 15,
          filters: {
            documentTypes: ["budget", "resolution", "report"],
          },
        });
      }

      case "youtube_search": {
        // Wyszukiwanie nagrań sesji na YouTube z dynamicznym zapytaniem
        const youtubeService = new YouTubeSessionService();
        await youtubeService.initializeWithUserConfig(this.userId);

        // Generuj dynamiczne zapytanie na podstawie kontekstu
        const searchResult = await youtubeService.searchWithContext(
          userMessage,
          {
            topics: intent.entities.topics,
          }
        );

        return {
          videos: searchResult.sessions,
          channelName: searchResult.channelName,
          success: searchResult.success,
        };
      }

      case "simple_answer":
      default:
        return null;
    }
  }

  /**
   * Syntezuj odpowiedź na podstawie wyników narzędzi
   */
  private async synthesizeResponse(
    userMessage: string,
    intent: DetectedIntent,
    toolResults: ToolExecutionResult[]
  ): Promise<{
    response: string;
    sources: Array<{ title: string; url?: string; type: string }>;
  }> {
    if (!this.llmClient) throw new Error("LLM client not initialized");

    const successfulResults = toolResults.filter((r) => r.success && r.data);

    if (successfulResults.length === 0) {
      return {
        response:
          "Przepraszam, nie udało się znaleźć odpowiednich informacji. Spróbuj przeformułować pytanie.",
        sources: [],
      };
    }

    // Zbierz źródła
    const sources: Array<{ title: string; url?: string; type: string }> = [];
    let contextForSynthesis = "";

    for (const result of successfulResults) {
      const data = result.data as Record<string, unknown>;

      // Obsługa informacji o transkrypcji YouTube dla sesji
      if (result.tool === "session_search" && data?.youtubeTranscription) {
        const transcription = data.youtubeTranscription as {
          available: boolean;
          status: "pending" | "completed" | "not_found";
          videoUrl?: string;
          videoTitle?: string;
          transcriptionDocumentId?: string;
          message: string;
        };

        if (transcription.status === "pending" && transcription.videoUrl) {
          // Dodaj interaktywną informację o dostępności transkrypcji
          contextForSynthesis += `\n\n📹 INFORMACJA O NAGRANIU YOUTUBE:\n`;
          contextForSynthesis += `${transcription.message}\n`;
          contextForSynthesis += `Tytuł: ${transcription.videoTitle}\n`;
          contextForSynthesis += `Link: ${transcription.videoUrl}\n\n`;
          contextForSynthesis += `⚠️ WAŻNE: Transkrypcja tego nagrania nie została jeszcze wykonana.\n`;
          contextForSynthesis += `Użytkownik może:\n`;
          contextForSynthesis += `1. Zlecić automatyczną transkrypcję nagrania (zajmie kilka minut)\n`;
          contextForSynthesis += `2. Obejrzeć nagranie bezpośrednio na YouTube\n`;
          contextForSynthesis += `3. Kontynuować analizę bez transkrypcji\n\n`;
        } else if (
          transcription.status === "completed" &&
          transcription.transcriptionDocumentId
        ) {
          // Transkrypcja jest dostępna - dołącz jej treść do kontekstu
          contextForSynthesis += `\n\n✅ TRANSKRYPCJA SESJI Z YOUTUBE:\n`;
          contextForSynthesis += `${transcription.message}\n`;
          contextForSynthesis += `Tytuł: ${transcription.videoTitle}\n`;
          contextForSynthesis += `Link: ${transcription.videoUrl}\n\n`;

          if (transcription.transcriptionContent) {
            // Dołącz pełną treść transkrypcji (z limitem 8000 znaków)
            contextForSynthesis += `TREŚĆ TRANSKRYPCJI:\n`;
            contextForSynthesis += transcription.transcriptionContent.substring(
              0,
              8000
            );
            contextForSynthesis += `\n\n`;

            // Dodaj do źródeł
            sources.push({
              title: `Transkrypcja: ${transcription.videoTitle}`,
              url: transcription.videoUrl,
              type: "transkrypcja YouTube",
            });
          }
        }
      }

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

      if (result.tool === "person_search") {
        const personData = data as {
          ragResults?: unknown[];
          deepResults?: { results?: unknown[] };
        };
        if (personData.ragResults) {
          for (const doc of (
            personData.ragResults as Array<{ title: string; content: string }>
          ).slice(0, 3)) {
            sources.push({ title: doc.title, type: "dokument lokalny" });
            contextForSynthesis += `\n[Dokument: ${
              doc.title
            }]\n${doc.content?.substring(0, 800)}\n`;
          }
        }
        if (personData.deepResults?.results) {
          for (const r of (
            personData.deepResults.results as Array<{
              title: string;
              url: string;
              content: string;
            }>
          ).slice(0, 3)) {
            sources.push({ title: r.title, url: r.url, type: "internet" });
            contextForSynthesis += `\n[Źródło: ${
              r.title
            }]\n${r.content?.substring(0, 800)}\n`;
          }
        }
      }

      // Obsługa wyników YouTube
      if (result.tool === "youtube_search") {
        const youtubeData = data as {
          videos?: Array<{
            id: string;
            title: string;
            url: string;
            publishedAt?: string;
            duration?: string;
            description?: string;
          }>;
          channelName?: string;
          success?: boolean;
        };

        if (youtubeData.videos && youtubeData.videos.length > 0) {
          contextForSynthesis += `\n\n📺 WYNIKI WYSZUKIWANIA YOUTUBE (${
            youtubeData.channelName || "YouTube"
          }):\n`;
          contextForSynthesis += `Znaleziono ${youtubeData.videos.length} nagrań wideo:\n\n`;

          for (const video of youtubeData.videos.slice(0, 10)) {
            sources.push({
              title: video.title,
              url: video.url,
              type: "YouTube",
            });
            contextForSynthesis += `- **${video.title}**\n`;
            contextForSynthesis += `  URL: ${video.url}\n`;
            if (video.publishedAt)
              contextForSynthesis += `  Data: ${video.publishedAt}\n`;
            if (video.duration)
              contextForSynthesis += `  Czas trwania: ${video.duration}\n`;
            if (video.description)
              contextForSynthesis += `  Opis: ${video.description.substring(
                0,
                200
              )}\n`;
            contextForSynthesis += `\n`;
          }
        } else {
          contextForSynthesis += `\n\n📺 YOUTUBE: Nie znaleziono nagrań dla tego zapytania.\n`;
          contextForSynthesis += `Możesz spróbować wyszukać ręcznie na YouTube lub sprawdzić kanał gminy/miasta.\n`;
        }
      }
    }

    // Synteza przez LLM
    const synthesisPrompt = `Na podstawie zebranych informacji, udziel wyczerpującej odpowiedzi na pytanie użytkownika.

PYTANIE: ${userMessage}

ZEBRANE INFORMACJE:
${contextForSynthesis.substring(0, 12000)}

ZASADY:
1. Odpowiedz konkretnie i rzeczowo
2. Jeśli informacje są sprzeczne - zaznacz to
3. Jeśli brakuje danych - powiedz wprost
4. Cytuj źródła gdy to możliwe
5. Formatuj odpowiedź czytelnie (nagłówki, listy)`;

    const completion = await this.llmClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "Jesteś asystentem radnego miejskiego. Tworzysz precyzyjne, merytoryczne odpowiedzi na podstawie dostarczonych źródeł.",
        },
        { role: "user", content: synthesisPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return {
      response: completion.choices[0]?.message?.content || "",
      sources,
    };
  }

  /**
   * Sprawdza dostępność transkrypcji YouTube dla danej sesji
   * Jeśli transkrypcja jest dostępna, pobiera jej treść z RAG
   */
  private async checkYouTubeTranscriptionAvailability(
    sessionNumber: number
  ): Promise<{
    available: boolean;
    status: "pending" | "completed" | "not_found";
    videoUrl?: string;
    videoTitle?: string;
    transcriptionDocumentId?: string;
    transcriptionContent?: string;
    message: string;
  }> {
    try {
      // Importuj supabase
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Szukaj w scraped_content YouTube z tym numerem sesji
      const { data: youtubeVideos } = await supabase
        .from("scraped_content")
        .select("*")
        .eq("content_type", "youtube_video")
        .eq("user_id", this.userId);

      if (!youtubeVideos || youtubeVideos.length === 0) {
        return {
          available: false,
          status: "not_found",
          message: "Brak nagrań YouTube dla tej sesji",
        };
      }

      // Filtruj po sessionNumber w metadata
      const matchingVideo = youtubeVideos.find(
        (v) =>
          v.metadata &&
          typeof v.metadata === "object" &&
          "sessionNumber" in v.metadata &&
          v.metadata.sessionNumber === sessionNumber
      );

      if (!matchingVideo) {
        return {
          available: false,
          status: "not_found",
          message: `Brak nagrania YouTube dla sesji nr ${sessionNumber}`,
        };
      }

      const metadata = matchingVideo.metadata as Record<string, unknown>;
      const transcriptionStatus = metadata.transcriptionStatus as string;
      const transcriptionDocumentId = metadata.transcriptionDocumentId as
        | string
        | undefined;

      if (transcriptionStatus === "completed" && transcriptionDocumentId) {
        // Pobierz treść transkrypcji z processed_documents
        const { data: transcriptionDoc } = await supabase
          .from("processed_documents")
          .select("content, title")
          .eq("id", transcriptionDocumentId)
          .single();

        return {
          available: true,
          status: "completed",
          videoUrl: matchingVideo.url,
          videoTitle: matchingVideo.title,
          transcriptionDocumentId,
          transcriptionContent: transcriptionDoc?.content || undefined,
          message: `Transkrypcja sesji nr ${sessionNumber} jest dostępna`,
        };
      }

      if (transcriptionStatus === "pending") {
        return {
          available: true,
          status: "pending",
          videoUrl: matchingVideo.url,
          videoTitle: matchingVideo.title,
          message: `Znaleziono nagranie sesji nr ${sessionNumber} na YouTube. Transkrypcja nie została jeszcze wykonana.`,
        };
      }

      return {
        available: true,
        status: "pending",
        videoUrl: matchingVideo.url,
        videoTitle: matchingVideo.title,
        message: `Znaleziono nagranie sesji nr ${sessionNumber} na YouTube`,
      };
    } catch (error) {
      console.error(
        "[AIOrchestrator] Error checking YouTube transcription:",
        error
      );
      return {
        available: false,
        status: "not_found",
        message: "Błąd sprawdzania dostępności transkrypcji",
      };
    }
  }
}

// ============================================================================
// HELPER: Sprawdź czy pytanie wymaga orchestracji
// ============================================================================

export function shouldUseOrchestrator(message: string): boolean {
  const triggers = [
    /pobierz.*dane/i,
    /wyszukaj.*informacje/i,
    /znajd[źż].*o\s/i,
    /przeanalizuj/i,
    /sprawd[źż]/i,
    /co\s+wiadomo\s+o/i,
    /kto\s+to\s+jest/i,
    /jakie\s+są\s+dane/i,
    /pełn[ae]\s+informacj/i,
    /wszystk[oi]\s+o\s/i,
    /research/i,
    /deep\s*search/i,
    /sesj[aię]\s+(nr|numer)?\s*\d/i,
    /uchwał[aęy]/i,
    /budżet/i,
    /radny|radnego|radnej/i,
    // YouTube / nagrania wideo
    /nagran|nagranie|wideo|video|youtube/i,
    /obejrz|transmisj|film.*sesj/i,
    /gdzie.*obejrze/i,
    /znajd[źż].*nagran/i,
  ];

  return triggers.some((pattern) => pattern.test(message));
}

// ============================================================================
// INVENTORY: Lista wszystkich dostępnych narzędzi
// ============================================================================

export const AVAILABLE_TOOLS = {
  deep_research: {
    name: "Deep Research",
    description:
      "Głębokie wyszukiwanie w internecie (Exa, Tavily, Serper, Brave)",
    avgTimeSeconds: 30,
    requiresApiKey: true,
    providers: ["exa", "tavily", "serper", "brave"],
  },
  rag_search: {
    name: "RAG Search",
    description:
      "Wyszukiwanie w lokalnej bazie dokumentów (processed_documents)",
    avgTimeSeconds: 5,
    requiresApiKey: false,
  },
  legal_analysis: {
    name: "Legal Reasoning Engine",
    description: "Analiza prawna z wykrywaniem ryzyk i rekomendacjami",
    avgTimeSeconds: 20,
    requiresApiKey: true,
  },
  session_search: {
    name: "Session Discovery",
    description:
      "Wyszukiwanie materiałów z sesji rady (transkrypcje, protokoły, wideo)",
    avgTimeSeconds: 10,
    requiresApiKey: false,
  },
  person_search: {
    name: "Person Search",
    description: "Wyszukiwanie informacji o osobach (radnych, urzędnikach)",
    avgTimeSeconds: 25,
    requiresApiKey: true,
  },
  document_fetch: {
    name: "Document Query",
    description: "Pobranie konkretnego dokumentu po nazwie/numerze",
    avgTimeSeconds: 5,
    requiresApiKey: false,
  },
  budget_analysis: {
    name: "Budget Analysis",
    description: "Analiza budżetowa gminy",
    avgTimeSeconds: 15,
    requiresApiKey: false,
  },
};

// ============================================================================
// SUGGESTED NEW TOOLS
// ============================================================================

export const SUGGESTED_TOOLS = [
  {
    name: "Voting Analysis",
    description:
      "Analiza głosowań radnych - jak głosował, statystyki, porównania",
    priority: "high",
    complexity: "medium",
  },
  {
    name: "Calendar Integration",
    description: "Integracja z kalendarzem sesji, powiadomienia o terminach",
    priority: "high",
    complexity: "low",
  },
  {
    name: "Interpellation Tracker",
    description: "Śledzenie interpelacji i zapytań radnych",
    priority: "medium",
    complexity: "medium",
  },
  {
    name: "Comparison Engine",
    description: "Porównywanie dokumentów, uchwał, budżetów między latami",
    priority: "medium",
    complexity: "high",
  },
  {
    name: "Real-time BIP Monitor",
    description:
      "Monitoring BIP w czasie rzeczywistym - nowe dokumenty, zmiany",
    priority: "high",
    complexity: "medium",
  },
  {
    name: "Email Digest Generator",
    description: "Generowanie cotygodniowych podsumowań dla radnego",
    priority: "medium",
    complexity: "low",
  },
  {
    name: "Public Opinion Analyzer",
    description:
      "Analiza opinii publicznej z mediów społecznościowych i lokalnych mediów",
    priority: "low",
    complexity: "high",
  },
  {
    name: "Grant & Funding Finder",
    description: "Wyszukiwanie dostępnych dotacji i funduszy dla gminy",
    priority: "high",
    complexity: "medium",
  },
];
