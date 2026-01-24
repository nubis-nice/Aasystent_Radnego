import { getLLMClient, getAIConfig } from "../ai/index.js";
import { supabase } from "../lib/supabase.js";
const INTENT_DETECTION_PROMPT = `Jesteś ekspertem od rozpoznawania intencji komend głosowych w aplikacji dla radnego.

Twoje zadanie: Przeanalizuj komendę głosową i określ intencję użytkownika.

DOSTĘPNE INTENCJE:

1. **navigation** - Użytkownik chce przejść do innej strony/sekcji
   Przykłady: "otwórz dokumenty", "pokaż dashboard", "przejdź do ustawień", "idź do czatu"
   Wyodrębnij: path (np. "/documents", "/dashboard", "/settings", "/chat")

2. **search** - Użytkownik chce wyszukać coś
   Przykłady: "znajdź uchwałę nr 123", "wyszukaj budżet", "szukaj sesji"
   Wyodrębnij: query (pełne zapytanie)

3. **chat** - Użytkownik chce zadać pytanie asystentowi AI
   Przykłady: "zapytaj o budżet", "wyjaśnij uchwałę", "co to znaczy", "powiedz mi o..."
   Wyodrębnij: message (treść pytania)

4. **control** - Użytkownik chce kontrolować aplikację (głośność, odtwarzanie itp.)
   Przykłady: "zatrzymaj", "pauza", "głośniej", "ciszej", "powtórz", "anuluj"
   Wyodrębnij: command (stop, pause, volume_up, volume_down, repeat, cancel)

5. **unknown** - Nie można określić intencji
   Gdy komenda jest niejasna lub nie pasuje do żadnej kategorii

SŁOWA KLUCZOWE:
- Navigation: "otwórz", "pokaż", "przejdź", "idź do", "wyświetl", "zobacz"
- Search: "znajdź", "wyszukaj", "szukaj", "poszukaj"
- Chat: "zapytaj", "wyjaśnij", "powiedz", "co", "jak", "dlaczego", "kiedy"
- Control: "zatrzymaj", "stop", "pauza", "głośniej", "ciszej", "powtórz", "anuluj"

MAPOWANIE ŚCIEŻEK:
- "dokumenty", "dokument" → /documents
- "dashboard", "panel", "strona główna" → /dashboard
- "czat", "chat", "rozmowa" → /chat
- "ustawienia", "opcje", "konfiguracja" → /settings
- "analizy", "analiza" → /analysis
- "research", "badania" → /research
- "źródła", "źródła danych" → /settings/data-sources

ZASADY:
- Zawsze wybierz najbardziej prawdopodobną intencję
- Confidence powinno być wysokie (>0.8) tylko gdy jesteś pewny
- Dla niejednoznacznych komend wybierz "unknown" z niskim confidence
- Wyodrębnij wszystkie istotne encje z komendy

Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "intent": "navigation",
  "confidence": 0.95,
  "entities": {
    "action": "navigate",
    "target": "documents",
    "path": "/documents"
  },
  "reasoning": "Komenda wyraźnie wskazuje chęć nawigacji do sekcji dokumentów"
}`;
export class VoiceIntentDetector {
    llmClient = null;
    llmModelName = "gpt-4o-mini";
    userId;
    assistantName = null;
    constructor(userId) {
        this.userId = userId;
    }
    async initialize() {
        if (this.llmClient)
            return;
        this.llmClient = await getLLMClient(this.userId);
        // Pobierz konfigurację modelu LLM z ustawień użytkownika
        try {
            const llmConfig = await getAIConfig(this.userId, "llm");
            this.llmModelName = llmConfig.modelName;
            console.log(`[VoiceIntent] Using LLM model: ${this.llmModelName}`);
        }
        catch {
            console.warn("[VoiceIntent] Failed to get LLM config, using default model");
        }
        await this.loadAssistantName();
    }
    async loadAssistantName() {
        try {
            const { data } = await supabase
                .from("user_ai_settings")
                .select("assistant_name")
                .eq("user_id", this.userId)
                .maybeSingle();
            this.assistantName = data?.assistant_name || "Asystent";
            console.log(`[VoiceIntent] Assistant name loaded: ${this.assistantName}`);
        }
        catch (error) {
            console.error("[VoiceIntent] Error loading assistant name:", error);
            this.assistantName = "Asystent";
        }
    }
    getAssistantName() {
        return this.assistantName || "Asystent";
    }
    stripWakeWord(transcription) {
        if (!this.assistantName)
            return transcription;
        const wakePatterns = [
            new RegExp(`^(hej|hey|cześć|witaj)?\\s*${this.assistantName}[,.]?\\s*`, "i"),
            new RegExp(`^(ok|okej)?\\s*${this.assistantName}[,.]?\\s*`, "i"),
        ];
        let result = transcription;
        for (const pattern of wakePatterns) {
            result = result.replace(pattern, "").trim();
        }
        return result || transcription;
    }
    isWakeWordDetected(transcription) {
        if (!this.assistantName)
            return false;
        const lowerTranscription = transcription.toLowerCase();
        const lowerName = this.assistantName.toLowerCase();
        return lowerTranscription.includes(lowerName);
    }
    async detectIntent(transcription) {
        await this.initialize();
        if (!this.llmClient) {
            throw new Error("LLM client not initialized");
        }
        // Strip wake word (assistant name) from transcription
        const cleanedTranscription = this.stripWakeWord(transcription);
        const lowerTranscription = cleanedTranscription.toLowerCase();
        console.log(`[VoiceIntent] Original: "${transcription}" → Cleaned: "${cleanedTranscription}"`);
        const quickPatterns = this.detectQuickPatterns(lowerTranscription);
        if (quickPatterns) {
            return quickPatterns;
        }
        try {
            const response = await this.llmClient.chat.completions.create({
                model: this.llmModelName,
                messages: [
                    {
                        role: "system",
                        content: INTENT_DETECTION_PROMPT,
                    },
                    {
                        role: "user",
                        content: `Komenda głosowa: "${cleanedTranscription}"`,
                    },
                ],
                temperature: 0.1,
                max_tokens: 300,
            });
            const content = response.choices[0].message.content;
            if (!content) {
                throw new Error("Empty response from LLM");
            }
            const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim();
            const result = JSON.parse(cleanedContent);
            console.log(`[VoiceIntent] Detected: ${result.intent} (${result.confidence})`);
            return {
                intent: result.intent,
                confidence: result.confidence,
                entities: result.entities || {},
                reasoning: result.reasoning,
            };
        }
        catch (error) {
            console.error("Intent detection error:", error);
            return {
                intent: "unknown",
                confidence: 0.5,
                entities: {},
                reasoning: "Błąd rozpoznawania intencji",
            };
        }
    }
    detectQuickPatterns(transcription) {
        const patterns = [
            {
                regex: /^(zatrzymaj|stop|pauza)$/i,
                intent: "control",
                entities: { command: "stop" },
                confidence: 0.99,
            },
            {
                regex: /^(głośniej|zwiększ głośność)$/i,
                intent: "control",
                entities: { command: "volume_up" },
                confidence: 0.99,
            },
            {
                regex: /^(ciszej|zmniejsz głośność)$/i,
                intent: "control",
                entities: { command: "volume_down" },
                confidence: 0.99,
            },
            {
                regex: /^(powtórz|jeszcze raz)$/i,
                intent: "control",
                entities: { command: "repeat" },
                confidence: 0.99,
            },
            {
                regex: /^(anuluj|wyjdź|zamknij)$/i,
                intent: "control",
                entities: { command: "cancel" },
                confidence: 0.99,
            },
        ];
        for (const pattern of patterns) {
            if (pattern.regex.test(transcription)) {
                return {
                    intent: pattern.intent,
                    confidence: pattern.confidence,
                    entities: pattern.entities,
                    reasoning: "Wykryto prostą komendę kontrolną",
                };
            }
        }
        return null;
    }
    mapIntentToPath(intent) {
        if (intent.intent !== "navigation") {
            return null;
        }
        const pathMappings = {
            dashboard: "/dashboard",
            documents: "/documents",
            dokumenty: "/documents",
            dokument: "/documents",
            chat: "/chat",
            czat: "/chat",
            rozmowa: "/chat",
            settings: "/settings",
            ustawienia: "/settings",
            opcje: "/settings",
            konfiguracja: "/settings",
            analysis: "/analysis",
            analizy: "/analysis",
            analiza: "/analysis",
            research: "/research",
            badania: "/research",
            źródła: "/settings/data-sources",
            "źródła danych": "/settings/data-sources",
        };
        const target = intent.entities.target;
        if (target && pathMappings[target.toLowerCase()]) {
            return pathMappings[target.toLowerCase()];
        }
        const path = intent.entities.path;
        if (path) {
            return path;
        }
        return null;
    }
}
//# sourceMappingURL=voice-intent-detector.js.map