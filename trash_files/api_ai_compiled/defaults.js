/**
 * AI Provider Defaults
 * Presety konfiguracji dla różnych providerów AI
 */
// ═══════════════════════════════════════════════════════════════════════════
// Presety konfiguracji
// ═══════════════════════════════════════════════════════════════════════════
export const PRESETS = {
    // ─────────────────────────────────────────────────────────────────────────
    // OPENAI - Oficjalne API OpenAI
    // ─────────────────────────────────────────────────────────────────────────
    openai: {
        id: "openai",
        name: "OpenAI",
        description: "Oficjalne API OpenAI - GPT-4, Whisper, DALL-E, TTS",
        functions: {
            llm: {
                name: "OpenAI GPT",
                provider: "openai",
                apiProtocol: "openai_compatible",
                baseUrl: "https://api.openai.com/v1",
                endpoint: "/chat/completions",
                defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
                authMethod: "bearer",
                requiresApiKey: true,
            },
            embeddings: {
                name: "OpenAI Embeddings",
                provider: "openai",
                apiProtocol: "openai_compatible",
                baseUrl: "https://api.openai.com/v1",
                endpoint: "/embeddings",
                defaultModel: "text-embedding-3-small",
                authMethod: "bearer",
                requiresApiKey: true,
            },
            vision: {
                name: "OpenAI Vision",
                provider: "openai",
                apiProtocol: "openai_compatible",
                baseUrl: "https://api.openai.com/v1",
                endpoint: "/chat/completions",
                defaultModel: process.env.OPENAI_VISION_MODEL || "gpt-4o",
                authMethod: "bearer",
                requiresApiKey: true,
            },
            stt: {
                name: "OpenAI Whisper",
                provider: "openai",
                apiProtocol: "openai_compatible",
                baseUrl: "https://api.openai.com/v1",
                endpoint: "/audio/transcriptions",
                defaultModel: "whisper-1",
                authMethod: "bearer",
                requiresApiKey: true,
            },
            tts: {
                name: "OpenAI TTS",
                provider: "openai",
                apiProtocol: "openai_compatible",
                baseUrl: "https://api.openai.com/v1",
                endpoint: "/audio/speech",
                defaultModel: "tts-1",
                authMethod: "bearer",
                requiresApiKey: true,
            },
        },
    },
    // ─────────────────────────────────────────────────────────────────────────
    // OLLAMA - Lokalne modele AI
    // ─────────────────────────────────────────────────────────────────────────
    ollama: {
        id: "ollama",
        name: "Ollama (Local)",
        description: "Lokalne modele AI - Llama, Mistral, nomic-embed + faster-whisper",
        functions: {
            llm: {
                name: "Ollama LLM",
                provider: "ollama",
                apiProtocol: "openai_compatible",
                baseUrl: "http://localhost:11434/v1",
                endpoint: "/chat/completions",
                defaultModel: "llama3.2",
                authMethod: "none",
                requiresApiKey: false,
            },
            embeddings: {
                name: "Ollama Embeddings",
                provider: "ollama",
                apiProtocol: "openai_compatible",
                baseUrl: "http://localhost:11434/v1",
                endpoint: "/embeddings",
                defaultModel: "nomic-embed-text",
                authMethod: "none",
                requiresApiKey: false,
            },
            vision: {
                name: "Ollama Vision",
                provider: "ollama",
                apiProtocol: "openai_compatible",
                baseUrl: "http://localhost:11434/v1",
                endpoint: "/chat/completions",
                defaultModel: process.env.OLLAMA_VISION_MODEL || "llava",
                authMethod: "none",
                requiresApiKey: false,
            },
            stt: {
                name: "Speaches STT (Local)",
                provider: "speaches",
                apiProtocol: "openai_compatible",
                baseUrl: "http://localhost:8001/v1",
                endpoint: "/audio/transcriptions",
                defaultModel: "Systran/faster-whisper-medium",
                authMethod: "none",
                requiresApiKey: false,
            },
            tts: {
                name: "Speaches TTS (Local)",
                provider: "speaches",
                apiProtocol: "openai_compatible",
                baseUrl: "http://localhost:8001/v1",
                endpoint: "/audio/speech",
                defaultModel: "speaches-ai/Kokoro-82M-v1.0-ONNX",
                authMethod: "none",
                requiresApiKey: false,
            },
        },
    },
    // ─────────────────────────────────────────────────────────────────────────
    // CUSTOM - Uniwersalny preset z pełną konfiguracją
    // ─────────────────────────────────────────────────────────────────────────
    custom: {
        id: "custom",
        name: "Custom (Własna konfiguracja)",
        description: "Dowolny endpoint - pełna kontrola nad każdą funkcją AI",
        functions: {
            llm: {
                name: "Custom LLM",
                provider: "custom",
                apiProtocol: "openai_compatible",
                baseUrl: "",
                endpoint: "/chat/completions",
                defaultModel: "",
                authMethod: "bearer",
                requiresApiKey: true,
            },
            embeddings: {
                name: "Custom Embeddings",
                provider: "custom",
                apiProtocol: "openai_compatible",
                baseUrl: "",
                endpoint: "/embeddings",
                defaultModel: "",
                authMethod: "bearer",
                requiresApiKey: true,
            },
            vision: {
                name: "Custom Vision",
                provider: "custom",
                apiProtocol: "openai_compatible",
                baseUrl: "",
                endpoint: "/chat/completions",
                defaultModel: "",
                authMethod: "bearer",
                requiresApiKey: true,
            },
            stt: {
                name: "Custom STT",
                provider: "custom",
                apiProtocol: "openai_compatible",
                baseUrl: "",
                endpoint: "/audio/transcriptions",
                defaultModel: "",
                authMethod: "bearer",
                requiresApiKey: true,
            },
            tts: {
                name: "Custom TTS",
                provider: "custom",
                apiProtocol: "openai_compatible",
                baseUrl: "",
                endpoint: "/audio/speech",
                defaultModel: "",
                authMethod: "bearer",
                requiresApiKey: true,
            },
        },
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// Protokoły API
// ═══════════════════════════════════════════════════════════════════════════
export const API_PROTOCOLS = {
    openai_compatible: {
        name: "OpenAI Compatible",
        description: "Standard OpenAI API (Ollama, vLLM, LM Studio, Together, Groq...)",
    },
    anthropic: {
        name: "Anthropic",
        description: "Anthropic Claude API",
    },
    custom: {
        name: "Custom",
        description: "Własny format - wymaga implementacji adaptera",
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// Funkcje pomocnicze
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Pobierz preset po ID
 */
export function getPreset(presetId) {
    return PRESETS[presetId];
}
/**
 * Pobierz konfigurację funkcji z presetu
 */
export function getPresetFunction(presetId, functionType) {
    return PRESETS[presetId]?.functions[functionType];
}
/**
 * Pobierz listę wszystkich presetów
 */
export function getAllPresets() {
    return Object.values(PRESETS);
}
/**
 * Sprawdź czy preset obsługuje daną funkcję
 */
export function presetSupportsFunction(presetId, functionType) {
    const preset = PRESETS[presetId];
    if (!preset)
        return false;
    const func = preset.functions[functionType];
    return func !== undefined && func.baseUrl !== "";
}
/**
 * Pobierz domyślny URL dla funkcji z presetu
 */
export function getDefaultBaseUrl(presetId, functionType) {
    return PRESETS[presetId]?.functions[functionType]?.baseUrl || undefined;
}
/**
 * Pobierz domyślny model dla funkcji z presetu
 */
export function getDefaultModel(presetId, functionType) {
    return PRESETS[presetId]?.functions[functionType]?.defaultModel || undefined;
}
/**
 * Lista wszystkich funkcji AI
 */
export const AI_FUNCTIONS = [
    "llm",
    "embeddings",
    "vision",
    "stt",
    "tts",
];
/**
 * Nazwy funkcji AI (do wyświetlania)
 */
export const AI_FUNCTION_NAMES = {
    llm: "LLM (Chat)",
    embeddings: "Embeddings",
    vision: "Vision",
    stt: "STT (Speech-to-Text)",
    tts: "TTS (Text-to-Speech)",
};
//# sourceMappingURL=defaults.js.map