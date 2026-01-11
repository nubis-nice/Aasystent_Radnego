/**
 * AI Module - Public Exports
 * Centralne zarządzanie providerami AI
 */

// Typy
export type {
  AIFunctionType,
  APIProtocol,
  AuthMethod,
  PresetId,
  TestStatus,
  AIFunctionConfig,
  ConfigPreset,
  AIProviderConfig,
  AIConfiguration,
  ResolvedAIConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatStreamChunk,
  TranscribeOptions,
  TranscribeResult,
  TranscribeSegment,
  TTSOptions,
  ILLMClient,
  IEmbeddingsClient,
  IVisionClient,
  ISTTClient,
  ITTSClient,
} from "./types.js";

export { AIError, AIErrorCode } from "./types.js";

// Presety i domyślne wartości
export {
  PRESETS,
  API_PROTOCOLS,
  AI_FUNCTIONS,
  AI_FUNCTION_NAMES,
  getPreset,
  getPresetFunction,
  getAllPresets,
  presetSupportsFunction,
  getDefaultBaseUrl,
  getDefaultModel,
} from "./defaults.js";

// Config Resolver
export { AIConfigResolver, getConfigResolver } from "./ai-config-resolver.js";

// Client Factory
export {
  AIClientFactory,
  getAIClientFactory,
  getLLMClient,
  getEmbeddingsClient,
  getVisionClient,
  getSTTClient,
  getTTSClient,
  getAIConfig,
  invalidateUserCache,
} from "./ai-client-factory.js";
