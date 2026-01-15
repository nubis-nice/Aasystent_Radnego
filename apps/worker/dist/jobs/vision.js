/**
 * Vision Job Handler - Przetwarzanie zadań OCR/Vision AI
 *
 * Obsługuje:
 * - Ollama Vision (qwen3-vl, llava, etc.)
 * - OpenAI Vision (gpt-4o, gpt-4-vision)
 * - Google Vision
 */
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
// Załaduj zmienne środowiskowe z głównego katalogu API
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../api/.env") });
// Lazy initialization - unikaj błędu przy imporcie
let _supabase = null;
function getSupabase() {
    if (!_supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new Error(`Missing Supabase config. SUPABASE_URL=${url ? "set" : "missing"}, ` +
                `SUPABASE_SERVICE_ROLE_KEY=${key ? "set" : "missing"}`);
        }
        _supabase = createClient(url, key);
    }
    return _supabase;
}
/**
 * Główna funkcja przetwarzania zadania Vision
 */
export async function processVision(job) {
    const startTime = Date.now();
    const { userId, imageBase64, prompt, provider, model, pageNumber } = job.data;
    console.log(`[vision-job] Processing job ${job.id} (provider=${provider}, model=${model}, page=${pageNumber})`);
    try {
        // Pobierz konfigurację AI użytkownika
        const config = await getUserAIConfig(userId, provider);
        // Utwórz klienta OpenAI (kompatybilny z Ollama)
        const client = new OpenAI({
            apiKey: config.apiKey || "dummy-key",
            baseURL: config.baseUrl,
            timeout: 120000, // 2 minuty timeout
        });
        // Zbuduj wiadomości w zależności od providera
        const messages = buildVisionMessages(provider, imageBase64, prompt);
        // Wywołaj Vision API
        await job.updateProgress(30);
        const response = (await client.chat.completions.create({
            model,
            messages,
            max_tokens: 4096,
        }));
        await job.updateProgress(80);
        const text = response.choices[0]?.message?.content || "";
        const processingTimeMs = Date.now() - startTime;
        console.log(`[vision-job] Job ${job.id} completed: ${text.length} chars in ${processingTimeMs}ms`);
        await job.updateProgress(100);
        return {
            success: true,
            text,
            confidence: 0.9,
            processingTimeMs,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[vision-job] Job ${job.id} failed:`, errorMessage);
        return {
            success: false,
            text: "",
            error: errorMessage,
            processingTimeMs: Date.now() - startTime,
        };
    }
}
/**
 * Pobierz konfigurację AI użytkownika z bazy
 */
async function getUserAIConfig(userId, provider) {
    // Domyślne wartości dla Ollama
    if (provider === "ollama") {
        return {
            apiKey: "dummy-key",
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
        };
    }
    // Pobierz z bazy dla innych providerów
    const { data } = await getSupabase()
        .from("user_ai_configs")
        .select("vision_provider, vision_api_key, vision_base_url")
        .eq("user_id", userId)
        .single();
    if (data) {
        return {
            apiKey: data.vision_api_key || process.env.OPENAI_API_KEY || "",
            baseUrl: data.vision_base_url || "https://api.openai.com/v1",
        };
    }
    // Fallback na env
    return {
        apiKey: process.env.OPENAI_API_KEY || "",
        baseUrl: "https://api.openai.com/v1",
    };
}
/**
 * Buduje wiadomości w formacie odpowiednim dla providera
 */
function buildVisionMessages(provider, imageBase64, prompt
// eslint-disable-next-line @typescript-eslint/no-explicit-any
) {
    const systemPrompt = `Jesteś ekspertem OCR. Twoim zadaniem jest dokładne odczytanie i transkrypcja CAŁEGO tekstu widocznego na obrazie.

Zasady:
1. Odczytaj CAŁY tekst, zachowując oryginalną strukturę i formatowanie
2. Zachowaj akapity, nagłówki, listy i wcięcia
3. Jeśli tekst jest w tabelce, odtwórz strukturę używając | jako separatora
4. Jeśli tekst jest nieczytelny, oznacz to jako [nieczytelne]
5. Nie dodawaj własnych komentarzy ani interpretacji
6. Odpowiedz TYLKO tekstem odczytanym z obrazu`;
    // Dla Ollama używamy formatu z polem "images"
    if (provider === "ollama") {
        return [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: prompt,
                images: [imageBase64], // Ollama format - base64 bez prefixu data:
            },
        ];
    }
    // Dla OpenAI i innych używamy standardowego formatu image_url
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    return [
        {
            role: "system",
            content: systemPrompt,
        },
        {
            role: "user",
            content: [
                {
                    type: "image_url",
                    image_url: {
                        url: dataUrl,
                        detail: "high",
                    },
                },
                {
                    type: "text",
                    text: prompt,
                },
            ],
        },
    ];
}
//# sourceMappingURL=vision.js.map