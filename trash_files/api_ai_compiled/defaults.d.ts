/**
 * AI Provider Defaults
 * Presety konfiguracji dla różnych providerów AI
 */
import type { AIFunctionType, AIFunctionConfig, ConfigPreset, PresetId } from "./types.js";
export declare const PRESETS: Record<PresetId, ConfigPreset>;
export declare const API_PROTOCOLS: {
    readonly openai_compatible: {
        readonly name: "OpenAI Compatible";
        readonly description: "Standard OpenAI API (Ollama, vLLM, LM Studio, Together, Groq...)";
    };
    readonly anthropic: {
        readonly name: "Anthropic";
        readonly description: "Anthropic Claude API";
    };
    readonly custom: {
        readonly name: "Custom";
        readonly description: "Własny format - wymaga implementacji adaptera";
    };
};
/**
 * Pobierz preset po ID
 */
export declare function getPreset(presetId: PresetId): ConfigPreset;
/**
 * Pobierz konfigurację funkcji z presetu
 */
export declare function getPresetFunction(presetId: PresetId, functionType: AIFunctionType): AIFunctionConfig | undefined;
/**
 * Pobierz listę wszystkich presetów
 */
export declare function getAllPresets(): ConfigPreset[];
/**
 * Sprawdź czy preset obsługuje daną funkcję
 */
export declare function presetSupportsFunction(presetId: PresetId, functionType: AIFunctionType): boolean;
/**
 * Pobierz domyślny URL dla funkcji z presetu
 */
export declare function getDefaultBaseUrl(presetId: PresetId, functionType: AIFunctionType): string | undefined;
/**
 * Pobierz domyślny model dla funkcji z presetu
 */
export declare function getDefaultModel(presetId: PresetId, functionType: AIFunctionType): string | undefined;
/**
 * Lista wszystkich funkcji AI
 */
export declare const AI_FUNCTIONS: AIFunctionType[];
/**
 * Nazwy funkcji AI (do wyświetlania)
 */
export declare const AI_FUNCTION_NAMES: Record<AIFunctionType, string>;
//# sourceMappingURL=defaults.d.ts.map