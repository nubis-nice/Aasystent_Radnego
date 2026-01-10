import OpenAI from "openai";
// Inicjalizacja klienta OpenAI
export function createOpenAIClient(apiKey) {
    return new OpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
}
// Konfiguracja modeli
export const MODELS = {
    GPT4_VISION: "gpt-4-vision-preview",
    GPT4_TURBO: "gpt-4-turbo-preview",
    GPT4: "gpt-4",
    GPT35_TURBO: "gpt-3.5-turbo",
    EMBEDDING: "text-embedding-3-small",
};
// Parametry dla deterministycznych wywołań
export const DETERMINISTIC_PARAMS = {
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
};
// Funkcja ekstrakcji tekstu z obrazu (PDF/skan)
export async function extractTextFromImage(client, imageBase64, mimeType) {
    const response = await client.chat.completions.create({
        model: MODELS.GPT4_VISION,
        ...DETERMINISTIC_PARAMS,
        messages: [
            {
                role: "system",
                content: `Jesteś ekspertem w ekstrakcji tekstu z dokumentów urzędowych.
Twoim zadaniem jest dokładne przepisanie całego tekstu z obrazu dokumentu.
Zachowaj strukturę, formatowanie i wszystkie szczegóły.
Jeśli tekst jest nieczytelny, zaznacz to jako [NIECZYTELNE].`,
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Przepisz cały tekst z tego dokumentu. Zachowaj strukturę i formatowanie.",
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${imageBase64}`,
                        },
                    },
                ],
            },
        ],
        max_tokens: 4096,
    });
    const extractedText = response.choices[0]?.message?.content || "";
    // Oblicz jakość ekstrakcji (heurystyka)
    const qualityScore = calculateExtractionQuality(extractedText);
    return {
        text: extractedText,
        qualityScore,
        metadata: {
            model: MODELS.GPT4_VISION,
            tokensUsed: response.usage?.total_tokens || 0,
            finishReason: response.choices[0]?.finish_reason,
        },
    };
}
// Funkcja generowania streszczenia
export async function generateSummary(client, text, promptVersion = "v1") {
    const response = await client.chat.completions.create({
        model: MODELS.GPT4_TURBO,
        ...DETERMINISTIC_PARAMS,
        messages: [
            {
                role: "system",
                content: `Jesteś asystentem radnego, specjalizującym się w analizie dokumentów samorządowych.
Twoim zadaniem jest tworzenie zwięzłych, ale kompletnych streszczeń dokumentów.`,
            },
            {
                role: "user",
                content: `Przeanalizuj poniższy dokument i:
1. Utwórz zwięzłe streszczenie (max 300 słów)
2. Wypisz 5-7 najważniejszych punktów

Dokument:
${text}

Odpowiedź w formacie JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."]
}`,
            },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
    });
    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    return {
        summary: result.summary || "",
        keyPoints: result.keyPoints || [],
        tokensUsed: response.usage?.total_tokens || 0,
    };
}
// Funkcja skanowania ryzyk
export async function scanForRisks(client, text, promptVersion = "v1") {
    const response = await client.chat.completions.create({
        model: MODELS.GPT4_TURBO,
        ...DETERMINISTIC_PARAMS,
        messages: [
            {
                role: "system",
                content: `Jesteś ekspertem prawnym specjalizującym się w prawie samorządowym.
Twoim zadaniem jest identyfikacja potencjalnych ryzyk prawnych, finansowych i proceduralnych w dokumentach.`,
            },
            {
                role: "user",
                content: `Przeanalizuj dokument pod kątem ryzyk:
- Prawnych (niezgodność z przepisami, brak podstawy prawnej)
- Finansowych (przekroczenie budżetu, brak zabezpieczenia środków)
- Proceduralnych (brak konsultacji, naruszenie procedur)

Dla każdego ryzyka podaj:
- typ (legal/financial/procedural)
- opis
- poziom (low/medium/high)
- cytat z dokumentu

Dokument:
${text}

Odpowiedź w formacie JSON:
{
  "risks": [
    {
      "type": "legal",
      "description": "...",
      "severity": "high",
      "citation": "..."
    }
  ]
}`,
            },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
    });
    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    return {
        risks: result.risks || [],
        tokensUsed: response.usage?.total_tokens || 0,
    };
}
// Funkcja generowania embeddingu
export async function generateEmbedding(client, text) {
    const response = await client.embeddings.create({
        model: MODELS.EMBEDDING,
        input: text,
        encoding_format: "float",
    });
    return response.data[0]?.embedding || [];
}
// Funkcja chunkowania tekstu
export function chunkText(text, maxTokens = 512, overlap = 50) {
    // Prosta heurystyka: ~4 znaki = 1 token
    const maxChars = maxTokens * 4;
    const overlapChars = overlap * 4;
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + maxChars, text.length);
        let chunk = text.slice(start, end);
        // Znajdź koniec zdania
        if (end < text.length) {
            const lastPeriod = chunk.lastIndexOf(".");
            const lastNewline = chunk.lastIndexOf("\n");
            const breakPoint = Math.max(lastPeriod, lastNewline);
            if (breakPoint > maxChars / 2) {
                chunk = chunk.slice(0, breakPoint + 1);
                start += breakPoint + 1;
            }
            else {
                start = end;
            }
        }
        else {
            start = end;
        }
        chunks.push(chunk.trim());
        // Overlap
        if (start < text.length) {
            start -= overlapChars;
        }
    }
    return chunks;
}
// Heurystyka jakości ekstrakcji
function calculateExtractionQuality(text) {
    if (!text || text.length < 50)
        return 0.0;
    let score = 1.0;
    // Penalizuj za [NIECZYTELNE]
    const unreadableCount = (text.match(/\[NIECZYTELNE\]/g) || []).length;
    score -= unreadableCount * 0.1;
    // Penalizuj za zbyt krótki tekst
    if (text.length < 200) {
        score -= 0.3;
    }
    // Penalizuj za brak polskich znaków (prawdopodobnie błąd)
    const polishChars = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
    if (!polishChars.test(text)) {
        score -= 0.2;
    }
    return Math.max(0, Math.min(1, score));
}
// Funkcja wykrywania relacji między dokumentami
export async function detectDocumentRelations(client, sourceText, targetText) {
    const response = await client.chat.completions.create({
        model: MODELS.GPT4_TURBO,
        ...DETERMINISTIC_PARAMS,
        messages: [
            {
                role: "system",
                content: `Jesteś ekspertem w analizie dokumentów prawnych i wykrywaniu relacji między nimi.
Twoim zadaniem jest określenie czy i jak dokumenty są ze sobą powiązane.`,
            },
            {
                role: "user",
                content: `Przeanalizuj relację między dokumentami:

DOKUMENT ŹRÓDŁOWY:
${sourceText.slice(0, 2000)}

DOKUMENT DOCELOWY:
${targetText.slice(0, 2000)}

Określ typ relacji:
- "amends" - dokument źródłowy zmienia docelowy
- "repeals" - dokument źródłowy uchyla docelowy
- "implements" - dokument źródłowy wykonuje/implementuje docelowy
- "references" - dokument źródłowy odnosi się do docelowego
- null - brak relacji

Odpowiedź w formacie JSON:
{
  "relationType": "amends" | "repeals" | "implements" | "references" | null,
  "description": "krótki opis relacji",
  "confidence": 0.0-1.0
}`,
            },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
    });
    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    return {
        relationType: result.relationType || null,
        description: result.description || "",
        confidence: result.confidence || 0,
    };
}
//# sourceMappingURL=openai.js.map