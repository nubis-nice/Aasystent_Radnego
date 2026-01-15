"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Save,
  RefreshCw,
  MessageSquare,
  Database,
  Eye,
  Mic,
  MicOff,
  Volume2,
  Check,
  AlertCircle,
  Loader2,
  Settings2,
  Sparkles,
  Radio,
  Square,
  TestTube,
} from "lucide-react";
import { ProviderType } from "@aasystent-radnego/shared";
import { AIConnectionTester } from "./AIConnectionTester";

// Typy funkcji AI
type AIFunctionType = "llm" | "embeddings" | "vision" | "stt" | "tts";

interface AIFunctionConfig {
  enabled: boolean;
  provider: "openai" | "local" | "custom";
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

interface AIConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AIConfigFormData) => Promise<void>;
  editingConfig?: {
    id: string;
    provider: ProviderType;
    name: string;
    base_url: string | null;
    model_name: string | null;
    embedding_model: string | null;
    transcription_model: string | null;
    vision_model: string | null;
    tts_model: string | null;
    provider_meta?: {
      llm_enabled?: boolean;
      embeddings_enabled?: boolean;
      vision_enabled?: boolean;
      stt_enabled?: boolean;
      tts_enabled?: boolean;
    } | null;
  } | null;
}

export interface AIConfigFormData {
  provider: ProviderType;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  embeddingModel: string;
  transcriptionModel: string;
  visionModel?: string;
  ttsModel?: string;
  // Stany enabled dla każdej funkcji
  llmEnabled?: boolean;
  embeddingsEnabled?: boolean;
  visionEnabled?: boolean;
  sttEnabled?: boolean;
  ttsEnabled?: boolean;
}

const AI_FUNCTIONS: {
  id: AIFunctionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: "llm",
    label: "Chat / LLM",
    description: "Modele językowe do konwersacji",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "blue",
  },
  {
    id: "embeddings",
    label: "Embeddings",
    description: "Wektory semantyczne dla RAG",
    icon: <Database className="h-5 w-5" />,
    color: "purple",
  },
  {
    id: "vision",
    label: "Vision",
    description: "Analiza obrazów i dokumentów",
    icon: <Eye className="h-5 w-5" />,
    color: "green",
  },
  {
    id: "stt",
    label: "Speech-to-Text",
    description: "Transkrypcja audio",
    icon: <Mic className="h-5 w-5" />,
    color: "orange",
  },
  {
    id: "tts",
    label: "Text-to-Speech",
    description: "Synteza mowy",
    icon: <Volume2 className="h-5 w-5" />,
    color: "pink",
  },
];

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    icon: "🤖",
    description: "GPT-4, Whisper, DALL-E",
  },
  {
    id: "local",
    name: "Ollama (Local)",
    icon: "💻",
    description: "Lokalne modele AI",
  },
  {
    id: "custom",
    name: "Custom API",
    icon: "🔧",
    description: "Własny endpoint",
  },
];

const DEFAULT_MODELS: Record<string, Record<AIFunctionType, string[]>> = {
  openai: {
    llm: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
    embeddings: [
      "text-embedding-3-small",
      "text-embedding-3-large",
      "text-embedding-ada-002",
    ],
    vision: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    stt: ["whisper-1"],
    tts: ["tts-1", "tts-1-hd"],
  },
  local: {
    llm: [
      "glm-4.6:cloud",
      "gpt-oss:120b-cloud",
      "llama3.2",
      "llama3.2:1b",
      "llama3.2:3b",
      "llama3.1",
      "llama3.1:8b",
      "mistral",
      "mixtral",
      "qwen2.5",
      "qwen2.5:7b",
      "deepseek-r1",
      "phi3",
      "gemma2",
      "codellama",
    ],
    embeddings: [
      "nomic-embed-text:latest",
      "qwen3-embedding:0.6b",
      "nomic-embed-text",
      "mxbai-embed-large",
      "all-minilm",
      "snowflake-arctic-embed",
      "bge-m3",
    ],
    vision: [
      "qwen3-vl:235b-cloud",
      "llava",
      "llava:13b",
      "bakllava",
      "moondream",
    ],
    stt: [
      "Systran/faster-whisper-medium",
      "Systran/faster-whisper-large-v3",
      "Systran/faster-whisper-small",
      "deepdml/faster-whisper-large-v3-turbo-ct2",
    ],
    tts: ["piper"],
  },
  custom: {
    llm: [],
    embeddings: [],
    vision: [],
    stt: [],
    tts: [],
  },
};

export function AIConfigurationModal({
  isOpen,
  onClose,
  onSave,
  editingConfig,
}: AIConfigurationModalProps) {
  const [activeTab, setActiveTab] = useState<AIFunctionType>("llm");
  const [configName, setConfigName] = useState("");
  const [globalProvider, setGlobalProvider] = useState<
    "openai" | "local" | "custom"
  >("openai");
  const [globalApiKey, setGlobalApiKey] = useState("");
  const [globalBaseUrl, setGlobalBaseUrl] = useState("");

  const [functionConfigs, setFunctionConfigs] = useState<
    Record<AIFunctionType, AIFunctionConfig>
  >({
    llm: {
      enabled: true,
      provider: "openai",
      apiKey: "",
      baseUrl: "",
      modelName: "gpt-4o",
    },
    embeddings: {
      enabled: true,
      provider: "openai",
      apiKey: "",
      baseUrl: "",
      modelName: "text-embedding-3-small",
    },
    vision: {
      enabled: false,
      provider: "openai",
      apiKey: "",
      baseUrl: "",
      modelName: "gpt-4o",
    },
    stt: {
      enabled: false,
      provider: "openai",
      apiKey: "",
      baseUrl: "",
      modelName: "whisper-1",
    },
    tts: {
      enabled: false,
      provider: "openai",
      apiKey: "",
      baseUrl: "",
      modelName: "tts-1",
    },
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<Record<string, string[]>>(
    {}
  );

  // Faster-Whisper dedykowane ustawienia
  const [sttBaseUrl, setSttBaseUrl] = useState("http://localhost:8000/v1");
  const [sttServerStatus, setSttServerStatus] = useState<
    "unknown" | "online" | "offline" | "checking"
  >("unknown");

  // Test mikrofonu
  const [micTestState, setMicTestState] = useState<
    "idle" | "recording" | "transcribing" | "done" | "error"
  >("idle");
  const [micTestResult, setMicTestResult] = useState<string | null>(null);
  const [micTestError, setMicTestError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Inicjalizacja z editingConfig
  useEffect(() => {
    if (editingConfig) {
      setConfigName(editingConfig.name);
      setGlobalProvider(
        editingConfig.provider as "openai" | "local" | "custom"
      );
      setGlobalBaseUrl(editingConfig.base_url || "");

      const providerType = editingConfig.provider as
        | "openai"
        | "local"
        | "custom";
      const defaultModels =
        DEFAULT_MODELS[providerType] || DEFAULT_MODELS.openai;

      const meta = editingConfig.provider_meta || {};

      setFunctionConfigs((prev) => ({
        ...prev,
        llm: {
          ...prev.llm,
          enabled: meta.llm_enabled !== false, // domyślnie włączone
          provider: providerType,
          modelName:
            editingConfig.model_name || defaultModels?.llm?.[0] || "gpt-4o",
        },
        embeddings: {
          ...prev.embeddings,
          enabled: meta.embeddings_enabled !== false, // domyślnie włączone
          provider: providerType,
          modelName:
            editingConfig.embedding_model ||
            defaultModels?.embeddings?.[0] ||
            "text-embedding-3-small",
        },
        vision: {
          ...prev.vision,
          enabled: meta.vision_enabled === true, // domyślnie wyłączone
          provider: providerType,
          modelName:
            editingConfig.vision_model || defaultModels?.vision?.[0] || "",
        },
        stt: {
          ...prev.stt,
          enabled: meta.stt_enabled === true, // domyślnie wyłączone
          provider: providerType,
          modelName:
            editingConfig.transcription_model ||
            defaultModels?.stt?.[0] ||
            "whisper-1",
        },
        tts: {
          ...prev.tts,
          enabled: meta.tts_enabled === true, // domyślnie wyłączone
          provider: providerType,
          modelName: editingConfig.tts_model || defaultModels?.tts?.[0] || "",
        },
      }));
    } else {
      // Reset do domyślnych wartości
      setConfigName("");
      setGlobalProvider("openai");
      setGlobalApiKey("");
      setGlobalBaseUrl("");
    }
    setError(null);
  }, [editingConfig, isOpen]);

  // Aktualizuj wszystkie funkcje gdy zmieni się globalny provider
  // Ale NIE nadpisuj modelName jeśli edytujemy istniejącą konfigurację
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Pomiń pierwszy render - modele są już ustawione z editingConfig lub domyślnych
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Tylko aktualizuj modele gdy użytkownik zmienia provider (nie przy ładowaniu)
    setFunctionConfigs((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(updated) as AIFunctionType[]) {
        updated[key] = {
          ...updated[key],
          provider: globalProvider,
          modelName: DEFAULT_MODELS[globalProvider]?.[key]?.[0] || "",
        };
      }
      return updated;
    });
  }, [globalProvider]);

  // Reset flagi gdy modal się zamyka
  useEffect(() => {
    if (!isOpen) {
      isFirstRender.current = true;
    }
  }, [isOpen]);

  const fetchModels = async () => {
    if (!globalApiKey && globalProvider !== "local") {
      setError("Podaj klucz API aby pobrać listę modeli");
      return;
    }

    setLoadingModels(true);
    setError(null);

    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/fetch-models`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: globalProvider,
            apiKey: globalApiKey,
            baseUrl: globalBaseUrl || undefined,
          }),
        }
      );

      const data = await response.json();

      if (data.success && data.models) {
        setDynamicModels({
          llm: data.models.map((m: { id: string }) => m.id),
          embeddings:
            data.embeddingModels?.map((m: { id: string }) => m.id) || [],
          vision: data.visionModels?.map((m: { id: string }) => m.id) || [],
          stt: data.transcriptionModels?.map((m: { id: string }) => m.id) || [],
          tts: [],
        });
      } else {
        setError(data.error || "Nie udało się pobrać modeli");
      }
    } catch (err) {
      console.error("Error fetching models:", err);
      setError("Błąd połączenia z API");
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = async () => {
    if (!configName.trim()) {
      setError("Nazwa konfiguracji jest wymagana");
      return;
    }

    if (!globalApiKey && !editingConfig && globalProvider !== "local") {
      setError("Klucz API jest wymagany");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const formData: AIConfigFormData = {
        provider: globalProvider as ProviderType,
        name: configName,
        apiKey: globalApiKey,
        baseUrl: globalBaseUrl,
        modelName: functionConfigs.llm.modelName,
        embeddingModel: functionConfigs.embeddings.modelName,
        transcriptionModel: functionConfigs.stt.modelName,
        visionModel: functionConfigs.vision.modelName || undefined,
        ttsModel: functionConfigs.tts.modelName || undefined,
        // Stany enabled dla każdej funkcji
        llmEnabled: functionConfigs.llm.enabled,
        embeddingsEnabled: functionConfigs.embeddings.enabled,
        visionEnabled: functionConfigs.vision.enabled,
        sttEnabled: functionConfigs.stt.enabled,
        ttsEnabled: functionConfigs.tts.enabled,
      };

      await onSave(formData);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Błąd podczas zapisywania";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const updateFunctionConfig = (
    func: AIFunctionType,
    updates: Partial<AIFunctionConfig>
  ) => {
    setFunctionConfigs((prev) => ({
      ...prev,
      [func]: { ...prev[func], ...updates },
    }));
  };

  const getModelsForFunction = (func: AIFunctionType): string[] => {
    let models: string[] = [];
    if (dynamicModels[func]?.length > 0) {
      models = [...dynamicModels[func]];
    } else {
      models = [...(DEFAULT_MODELS[globalProvider]?.[func] || [])];
    }

    // Dodaj aktualnie wybraną wartość jeśli nie jest na liście
    const currentValue = functionConfigs[func].modelName;
    if (currentValue && !models.includes(currentValue)) {
      models.unshift(currentValue);
    }

    return models;
  };

  // Test serwera Faster-Whisper (przez proxy API)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const checkSttServer = useCallback(async () => {
    setSttServerStatus("checking");
    try {
      const response = await fetch(
        `${API_URL}/api/stt/status?baseUrl=${encodeURIComponent(sttBaseUrl)}`,
        {
          method: "GET",
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === "online") {
          setSttServerStatus("online");
          // Zaktualizuj listę modeli STT
          if (data.models?.length > 0) {
            setDynamicModels((prev) => ({ ...prev, stt: data.models }));
          }
        } else {
          setSttServerStatus("offline");
        }
      } else {
        setSttServerStatus("offline");
      }
    } catch {
      setSttServerStatus("offline");
    }
  }, [sttBaseUrl, API_URL]);

  // Test mikrofonu z transkrypcją (przez proxy API)
  const startMicTest = async () => {
    setMicTestState("recording");
    setMicTestResult(null);
    setMicTestError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) {
          setMicTestState("error");
          setMicTestError("Brak danych audio");
          return;
        }

        setMicTestState("transcribing");

        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          const formData = new FormData();
          formData.append("file", audioBlob, "test.webm");

          const model =
            functionConfigs.stt.modelName || "Systran/faster-whisper-medium";
          const response = await fetch(
            `${API_URL}/api/stt/transcribe-test?baseUrl=${encodeURIComponent(
              sttBaseUrl
            )}&model=${encodeURIComponent(model)}`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setMicTestResult(result.text || "(brak tekstu)");
              setMicTestState("done");
            } else {
              setMicTestError(result.error || "Błąd transkrypcji");
              setMicTestState("error");
            }
          } else {
            const error = await response.text();
            setMicTestError(`Błąd serwera: ${error}`);
            setMicTestState("error");
          }
        } catch (err) {
          setMicTestError(
            err instanceof Error ? err.message : "Błąd transkrypcji"
          );
          setMicTestState("error");
        }
      };

      mediaRecorder.start();

      // Automatycznie zatrzymaj po 5 sekundach
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 5000);
    } catch (err) {
      setMicTestError(
        err instanceof Error ? err.message : "Brak dostępu do mikrofonu"
      );
      setMicTestState("error");
    }
  };

  const stopMicTest = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  // Sprawdź serwer STT przy włączeniu zakładki
  useEffect(() => {
    if (
      activeTab === "stt" &&
      functionConfigs.stt.enabled &&
      sttServerStatus === "unknown"
    ) {
      checkSttServer();
    }
  }, [activeTab, functionConfigs.stt.enabled, sttServerStatus, checkSttServer]);

  if (!isOpen) return null;

  const currentFunction = AI_FUNCTIONS.find((f) => f.id === activeTab)!;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Settings2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {editingConfig
                  ? "Edytuj konfigurację AI"
                  : "Nowa konfiguracja AI"}
              </h2>
              <p className="text-sm text-slate-400">
                Skonfiguruj providery dla każdej funkcji AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Function Tabs */}
          <div className="w-56 bg-slate-50 border-r border-slate-200 p-4 space-y-2">
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Funkcje AI
              </label>
            </div>
            {AI_FUNCTIONS.map((func) => (
              <button
                key={func.id}
                onClick={() => setActiveTab(func.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                  activeTab === func.id
                    ? "bg-white shadow-sm border border-slate-200 text-slate-900"
                    : "text-slate-600 hover:bg-white/50"
                }`}
              >
                <div
                  className={`p-1.5 rounded-md ${
                    activeTab === func.id
                      ? `bg-${func.color}-100 text-${func.color}-600`
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {func.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {func.label}
                  </div>
                  {functionConfigs[func.id].enabled && (
                    <div className="text-xs text-slate-400 truncate">
                      {functionConfigs[func.id].modelName}
                    </div>
                  )}
                </div>
                {functionConfigs[func.id].enabled && (
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Global Settings */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900">
                  Ustawienia globalne
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Config Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nazwa konfiguracji
                  </label>
                  <input
                    type="text"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    placeholder="np. Produkcja, Development"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    disabled={saving}
                  />
                </div>

                {/* Global Provider */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Domyślny provider
                  </label>
                  <select
                    value={globalProvider}
                    onChange={(e) =>
                      setGlobalProvider(
                        e.target.value as "openai" | "local" | "custom"
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    disabled={saving}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Klucz API {globalProvider === "local" && "(opcjonalny)"}
                  </label>
                  <input
                    type="password"
                    value={globalApiKey}
                    onChange={(e) => setGlobalApiKey(e.target.value)}
                    placeholder={editingConfig ? "••••••••••••••••" : "sk-..."}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    disabled={saving}
                  />
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Base URL {globalProvider !== "custom" && "(opcjonalny)"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={globalBaseUrl}
                      onChange={(e) => setGlobalBaseUrl(e.target.value)}
                      placeholder={
                        globalProvider === "local"
                          ? "http://localhost:11434/v1"
                          : "https://api.openai.com/v1"
                      }
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      disabled={saving}
                    />
                    <button
                      onClick={fetchModels}
                      disabled={loadingModels || saving}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      title="Pobierz modele z API"
                    >
                      {loadingModels ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Function Config */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div
                className={`px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-${currentFunction.color}-50 to-white`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg bg-${currentFunction.color}-100 text-${currentFunction.color}-600`}
                    >
                      {currentFunction.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {currentFunction.label}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {currentFunction.description}
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-slate-600">Włączone</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={functionConfigs[activeTab].enabled}
                        onChange={(e) =>
                          updateFunctionConfig(activeTab, {
                            enabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                        disabled={saving}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                  </label>
                </div>
              </div>

              {functionConfigs[activeTab].enabled && (
                <div className="p-5 space-y-4">
                  {/* Model Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Model
                    </label>
                    <select
                      value={functionConfigs[activeTab].modelName}
                      onChange={(e) =>
                        updateFunctionConfig(activeTab, {
                          modelName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      disabled={saving}
                    >
                      <option value="">Wybierz model...</option>
                      {getModelsForFunction(activeTab).map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={functionConfigs[activeTab].modelName}
                      onChange={(e) =>
                        updateFunctionConfig(activeTab, {
                          modelName: e.target.value,
                        })
                      }
                      placeholder="Lub wpisz nazwę modelu ręcznie..."
                      className="w-full mt-2 px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      disabled={saving}
                    />
                  </div>

                  {/* Custom API Key for this function (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Klucz API (opcjonalny - nadpisuje globalny)
                    </label>
                    <input
                      type="password"
                      value={functionConfigs[activeTab].apiKey}
                      onChange={(e) =>
                        updateFunctionConfig(activeTab, {
                          apiKey: e.target.value,
                        })
                      }
                      placeholder="Pozostaw puste aby użyć globalnego klucza"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      disabled={saving}
                    />
                  </div>

                  {/* Sekcja Faster-Whisper - tylko dla STT */}
                  {activeTab === "stt" && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <div className="flex items-center gap-2 mb-4">
                        <Radio className="h-5 w-5 text-orange-600" />
                        <h4 className="font-semibold text-slate-900">
                          Serwer Faster-Whisper
                        </h4>
                      </div>

                      {/* Base URL dla STT */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          URL serwera transkrypcji
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={sttBaseUrl}
                            onChange={(e) => setSttBaseUrl(e.target.value)}
                            placeholder="http://localhost:8000/v1"
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                            disabled={saving}
                          />
                          <button
                            onClick={checkSttServer}
                            disabled={sttServerStatus === "checking"}
                            className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            title="Sprawdź połączenie"
                          >
                            {sttServerStatus === "checking" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <TestTube className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {/* Status serwera */}
                        <div className="mt-2 flex items-center gap-2">
                          {sttServerStatus === "online" && (
                            <span className="flex items-center gap-1.5 text-sm text-green-600">
                              <Check className="h-4 w-4" />
                              Serwer online
                            </span>
                          )}
                          {sttServerStatus === "offline" && (
                            <span className="flex items-center gap-1.5 text-sm text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              Serwer niedostępny - uruchom Docker
                            </span>
                          )}
                          {sttServerStatus === "checking" && (
                            <span className="flex items-center gap-1.5 text-sm text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Sprawdzanie...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Test mikrofonu */}
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Mic className="h-5 w-5 text-orange-600" />
                          <h5 className="font-medium text-slate-900">
                            Test mikrofonu
                          </h5>
                        </div>

                        <p className="text-sm text-slate-600 mb-3">
                          Nagraj 5 sekund audio, aby przetestować transkrypcję.
                        </p>

                        <div className="flex items-center gap-3">
                          {micTestState === "idle" && (
                            <button
                              onClick={startMicTest}
                              disabled={sttServerStatus !== "online"}
                              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                              <Mic className="h-4 w-4" />
                              Rozpocznij nagrywanie
                            </button>
                          )}

                          {micTestState === "recording" && (
                            <button
                              onClick={stopMicTest}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 animate-pulse"
                            >
                              <Square className="h-4 w-4" />
                              Zatrzymaj (lub poczekaj 5s)
                            </button>
                          )}

                          {micTestState === "transcribing" && (
                            <div className="flex items-center gap-2 text-orange-600">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Transkrybuję...</span>
                            </div>
                          )}

                          {micTestState === "done" && (
                            <button
                              onClick={() => setMicTestState("idle")}
                              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Powtórz test
                            </button>
                          )}

                          {micTestState === "error" && (
                            <button
                              onClick={() => setMicTestState("idle")}
                              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Spróbuj ponownie
                            </button>
                          )}
                        </div>

                        {/* Wynik testu */}
                        {micTestResult && (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-700 mb-1">
                              <Check className="h-4 w-4" />
                              <span className="font-medium">Transkrypcja:</span>
                            </div>
                            <p className="text-green-800 italic">
                              &quot;{micTestResult}&quot;
                            </p>
                          </div>
                        )}

                        {micTestError && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 text-red-700">
                              <MicOff className="h-4 w-4" />
                              <span>{micTestError}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Connection Tester */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <AIConnectionTester
                config={{
                  provider: globalProvider,
                  apiKey: globalApiKey,
                  baseUrl:
                    globalBaseUrl ||
                    (globalProvider === "local"
                      ? "http://localhost:11434/v1"
                      : globalProvider === "openai"
                      ? "https://api.openai.com/v1"
                      : ""),
                  models: {
                    llm: functionConfigs.llm.modelName,
                    embeddings: functionConfigs.embeddings.modelName,
                    vision: functionConfigs.vision.modelName,
                    stt: functionConfigs.stt.modelName,
                    tts: functionConfigs.tts.modelName,
                  },
                  enabledFunctions: (
                    Object.keys(functionConfigs) as AIFunctionType[]
                  ).filter((f) => functionConfigs[f].enabled),
                }}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {Object.values(functionConfigs).filter((f) => f.enabled).length} z{" "}
            {AI_FUNCTIONS.length} funkcji włączonych
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-white transition-colors disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={
                saving ||
                (!globalApiKey && !editingConfig && globalProvider !== "local")
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingConfig ? "Zapisz zmiany" : "Utwórz konfigurację"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
