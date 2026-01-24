/**
 * Vision Job Handler - Przetwarzanie zadań OCR/Vision AI
 *
 * Obsługuje:
 * - Ollama Vision (qwen3-vl, llava, etc.)
 * - OpenAI Vision (gpt-4o, gpt-4-vision)
 * - Google Vision
 */

import { Job } from "bullmq";
import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Załaduj zmienne środowiskowe z głównego katalogu API
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../api/.env") });

// Lazy initialization - unikaj błędu przy imporcie
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        `Missing Supabase config. SUPABASE_URL=${url ? "set" : "missing"}, ` +
          `SUPABASE_SERVICE_ROLE_KEY=${key ? "set" : "missing"}`,
      );
    }

    _supabase = createClient(url, key);
  }
  return _supabase;
}

export interface VisionJobData {
  id: string;
  userId: string;
  imageBase64: string;
  prompt: string;
  pageNumber?: number;
  fileName?: string;
  provider: string;
  model: string;
  createdAt: string;
}

export interface VisionJobResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Główna funkcja przetwarzania zadania Vision
 */
export async function processVision(
  job: Job<VisionJobData>,
): Promise<VisionJobResult> {
  const startTime = Date.now();
  const { userId, imageBase64, prompt, provider, model, pageNumber } = job.data;

  console.log(
    `[vision-job] Processing job ${job.id} (provider=${provider}, model=${model}, page=${pageNumber})`,
  );

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
    } as Parameters<
      typeof client.chat.completions.create
    >[0])) as OpenAI.Chat.ChatCompletion;

    await job.updateProgress(80);

    const text = response.choices[0]?.message?.content || "";
    const processingTimeMs = Date.now() - startTime;

    console.log(
      `[vision-job] Job ${job.id} completed: ${text.length} chars in ${processingTimeMs}ms`,
    );

    await job.updateProgress(100);

    return {
      success: true,
      text,
      confidence: 0.9,
      processingTimeMs,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
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
async function getUserAIConfig(
  userId: string,
  provider: string,
): Promise<{ apiKey: string; baseUrl: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("api_configurations")
    .select(
      "provider, base_url, api_key_encrypted, vision_model, provider_meta, is_default",
    )
    .eq("user_id", userId)
    .eq("config_type", "ai")
    .eq("is_active", true)
    .eq("provider", provider)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    return {
      apiKey:
        decodeApiKey(data.api_key_encrypted) || getDefaultApiKey(provider),
      baseUrl: getBaseUrl(provider, data.base_url),
    };
  }

  // Jeśli nie znaleziono konkretnego providera, spróbuj domyślnej konfiguracji użytkownika
  const { data: defaultConfig } = await supabase
    .from("api_configurations")
    .select("provider, base_url, api_key_encrypted")
    .eq("user_id", userId)
    .eq("config_type", "ai")
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (defaultConfig) {
    return {
      apiKey:
        decodeApiKey(defaultConfig.api_key_encrypted) ||
        getDefaultApiKey(defaultConfig.provider),
      baseUrl: getBaseUrl(defaultConfig.provider, defaultConfig.base_url),
    };
  }

  return {
    apiKey: getDefaultApiKey(provider),
    baseUrl: getBaseUrl(provider, undefined),
  };
}

function decodeApiKey(encrypted: string | null): string {
  if (!encrypted) return "";
  try {
    const decoded = Buffer.from(encrypted, "base64").toString("utf-8");
    try {
      return decodeURIComponent(decoded);
    } catch {
      return decoded;
    }
  } catch {
    return encrypted;
  }
}

function getBaseUrl(provider: string, override?: string | null): string {
  if (override && override.trim().length > 0) {
    return override;
  }
  if (provider === "local" || provider === "ollama") {
    return process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
  }
  return process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
}

function getDefaultApiKey(provider: string): string {
  if (provider === "local" || provider === "ollama") {
    return process.env.OLLAMA_API_KEY || "";
  }
  return process.env.OPENAI_API_KEY || "";
}

/**
 * Buduje wiadomości w formacie odpowiednim dla providera
 */
function buildVisionMessages(
  provider: string,
  imageBase64: string,
  prompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
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
