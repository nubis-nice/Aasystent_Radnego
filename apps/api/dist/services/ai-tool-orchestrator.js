/**
 * AI Tool Orchestrator - Inteligentna orchestracja narzędzi AI
 */
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
import { getLLMClient, getAIConfig } from "../ai/index.js";
const INTENT_DETECTION_PROMPT = `Jesteś ekspertem od analizy intencji użytkownika. Wybierz JEDNO narzędzie jako primaryIntent.

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
- **rag_search** → uchwała, protokół, dokument lokalny (bez numeru sesji)
- **document_fetch** → pobranie konkretnego dokumentu po numerze/referencji
- **budget_analysis** → budżet gminy, wydatki, dochody, finanse

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
- **quick_tool** → "utwórz interpelację", "napisz pismo", "generuj protokół", "analiza budżetu"
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
    userId;
    llmClient = null;
    model = "gpt-4o-mini";
    constructor(userId) {
        this.userId = userId;
    }
    async initialize() {
        if (this.llmClient)
            return;
        this.llmClient = await getLLMClient(this.userId);
        const config = await getAIConfig(this.userId, "llm");
        this.model = config.modelName;
    }
    async process(userMessage, conversationContext) {
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
        const { response, sources } = await this.synthesizeResponse(userMessage, intent, toolResults);
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
    async detectIntent(userMessage, context) {
        if (!this.llmClient)
            throw new Error("LLM client not initialized");
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
                .map((n) => {
                if (typeof n === "number")
                    return Math.floor(n);
                if (typeof n === "string") {
                    const parsed = parseInt(n, 10);
                    return isNaN(parsed) ? null : parsed;
                }
                return null;
            })
                .filter((n) => n !== null && n > 0);
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
                userFriendlyDescription: result.userFriendlyDescription || "Przetwarzanie zapytania...",
            };
        }
        catch (error) {
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
    async executeTools(intent, userMessage) {
        const tools = [intent.primaryIntent, ...intent.secondaryIntents];
        const results = [];
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
            }
            catch (error) {
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
    async executeSingleTool(tool, userMessage, intent) {
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
                    const ragService = new LegalSearchAPI(this.userId);
                    return await ragService.search({
                        query: `sesja rady ${userMessage}`,
                        searchMode: "hybrid",
                        maxResults: 10,
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
                    query: `budżet ${intent.entities.topics.join(" ")} ${intent.entities.dates.join(" ")}`,
                    searchMode: "hybrid",
                    maxResults: 15,
                    filters: { documentTypes: ["budget", "resolution", "report"] },
                });
            }
            case "youtube_search": {
                const youtubeService = new YouTubeSessionService();
                await youtubeService.initializeWithUserConfig(this.userId);
                const searchResult = await youtubeService.searchWithContext(userMessage, { topics: intent.entities.topics });
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
                const unit = await gusService.findGmina(gminaName);
                if (!unit) {
                    return {
                        type: "not_found",
                        message: `Nie znaleziono jednostki terytorialnej: ${gminaName}`,
                        suggestion: "Spróbuj podać pełną nazwę gminy",
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
                    const localGovActs = await isapService.searchLocalGovernmentActs(topic, 15);
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
                    const opportunities = await euService.findFundingOpportunities(projectType);
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
                const coordMatch = userMessage.match(/(\d+[.,]\d+)\s*[,;\s]\s*(\d+[.,]\d+)/);
                if (coordMatch) {
                    const lat = parseFloat(coordMatch[1].replace(",", "."));
                    const lon = parseFloat(coordMatch[2].replace(",", "."));
                    const parcel = await geoportalService.getParcelByCoordinates(lat, lon);
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
                const coordMatch = userMessage.match(/(\d+[.,]\d+)\s*[,;\s]\s*(\d+[.,]\d+)/);
                if (coordMatch) {
                    const lat = parseFloat(coordMatch[1].replace(",", "."));
                    const lon = parseFloat(coordMatch[2].replace(",", "."));
                    const data = await gdosService.getEnvironmentalDataAtLocation(lat, lon);
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
    async synthesizeResponse(userMessage, intent, toolResults) {
        if (!this.llmClient)
            throw new Error("LLM client not initialized");
        const successfulResults = toolResults.filter((r) => r.success && r.data);
        if (successfulResults.length === 0) {
            return {
                response: "Przepraszam, nie udało się znaleźć odpowiednich informacji.",
                sources: [],
            };
        }
        const sources = [];
        let contextForSynthesis = "";
        for (const result of successfulResults) {
            const data = result.data;
            if (result.tool === "deep_research" && data?.results) {
                const results = data.results;
                for (const r of results.slice(0, 5)) {
                    sources.push({ title: r.title, url: r.url, type: "internet" });
                    contextForSynthesis += `\n[Źródło: ${r.title}]\n${r.content?.substring(0, 1000)}\n`;
                }
            }
            if (result.tool === "rag_search" && Array.isArray(data)) {
                for (const doc of data.slice(0, 5)) {
                    sources.push({
                        title: doc.title,
                        url: doc.sourceUrl,
                        type: "dokument lokalny",
                    });
                    contextForSynthesis += `\n[Dokument: ${doc.title}]\n${doc.content?.substring(0, 1000)}\n`;
                }
            }
            if (result.tool === "youtube_search") {
                const youtubeData = data;
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
                const gusData = data;
                if (gusData.type === "gmina_stats" && gusData.unit && gusData.stats) {
                    contextForSynthesis += `\n📊 STATYSTYKI GUS - ${gusData.unit.name}:\n`;
                    sources.push({
                        title: `GUS BDL: ${gusData.unit.name}`,
                        url: "https://bdl.stat.gov.pl",
                        type: "GUS",
                    });
                    if (gusData.stats.variables) {
                        for (const v of gusData.stats.variables) {
                            contextForSynthesis += `- ${v.name}: ${v.value.toLocaleString("pl-PL")} ${v.unit} (${v.year})\n`;
                        }
                    }
                }
            }
            if (result.tool === "isap_legal") {
                const isapData = data;
                if (isapData.acts && isapData.acts.length > 0) {
                    contextForSynthesis += `\n⚖️ AKTY PRAWNE Z ISAP (${isapData.count} wyników):\n`;
                    for (const act of isapData.acts.slice(0, 10)) {
                        sources.push({
                            title: act.title.substring(0, 80),
                            url: `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=${act.ELI}`,
                            type: "ISAP",
                        });
                        contextForSynthesis += `- ${act.displayAddress} (${act.type})\n  ${act.title.substring(0, 150)}...\n  Status: ${act.status}\n`;
                    }
                }
            }
            if (result.tool === "eu_funds") {
                const euData = data;
                if (euData.type === "active_competitions" && euData.competitions) {
                    contextForSynthesis += `\n🇪🇺 AKTUALNE KONKURSY UE:\n`;
                    for (const comp of euData.competitions.slice(0, 5)) {
                        sources.push({
                            title: comp.title,
                            url: comp.url,
                            type: "Fundusze UE",
                        });
                        contextForSynthesis += `- ${comp.title}\n  Program: ${comp.program}\n  Budżet: ${comp.budget.toLocaleString("pl-PL")} PLN\n  Termin: ${comp.endDate}\n`;
                    }
                }
            }
            if (result.tool === "calendar_add" ||
                result.tool === "calendar_list" ||
                result.tool === "calendar_edit" ||
                result.tool === "calendar_delete" ||
                result.tool === "task_add" ||
                result.tool === "task_list" ||
                result.tool === "task_complete" ||
                result.tool === "task_delete" ||
                result.tool === "alert_check" ||
                result.tool === "quick_tool" ||
                result.tool === "app_navigate") {
                const actionData = data;
                if (actionData.message) {
                    return {
                        response: actionData.message,
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
                    content: "Jesteś asystentem radnego miejskiego. Tworzysz precyzyjne odpowiedzi na podstawie dostarczonych źródeł.",
                },
                { role: "user", content: synthesisPrompt },
            ],
            temperature: 0.3,
            max_tokens: 2000,
        });
        return { response: completion.choices[0]?.message?.content || "", sources };
    }
}
export function shouldUseOrchestrator(message) {
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
        /sesj[aię]\s+(nr|numer)?\s*\d/i,
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
        description: "Rejestr jednostek terytorialnych - gminy, powiaty, województwa",
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
//# sourceMappingURL=ai-tool-orchestrator.js.map