"use client";

import { useState, useEffect } from "react";
import { X, Save, RefreshCw, DollarSign, Zap, Award } from "lucide-react";
import { ProviderType } from "@aasystent-radnego/shared";
import {
  ProviderSelector,
  CredentialsInput,
  EndpointConfig,
  ConnectionTester,
} from "./index";

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ConfigFormData) => Promise<void>;
  editingConfig?: {
    id: string;
    provider: ProviderType | "exa" | "perplexity" | "tavily";
    name: string;
    base_url: string | null;
    model_name: string | null;
  } | null;
}

export interface ConfigFormData {
  provider: ProviderType | "exa" | "perplexity" | "tavily";
  name: string;
  apiKey: string;
  baseUrl: string;
  chatEndpoint: string;
  embeddingsEndpoint: string;
  modelsEndpoint: string;
  modelName: string;
  visionModel?: string;
  embeddingModel: string;
  transcriptionModel: string;
}

export function ConfigurationModal({
  isOpen,
  onClose,
  onSave,
  editingConfig,
}: ConfigurationModalProps) {
  const [formData, setFormData] = useState<ConfigFormData>({
    provider: "openai" as ProviderType,
    name: "",
    apiKey: "",
    baseUrl: "",
    chatEndpoint: "",
    embeddingsEndpoint: "",
    modelsEndpoint: "",
    modelName: "",
    visionModel: "",
    embeddingModel: "text-embedding-3-small",
    transcriptionModel: "whisper-1",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stan dla dynamicznych modeli z metadanami
  const [dynamicModels, setDynamicModels] = useState<
    {
      id: string;
      name: string;
      pricing?: { input: number; output: number };
      performance?: {
        speed: "fast" | "medium" | "slow";
        contextWindow: number;
        quality: "high" | "medium" | "low";
      };
      badges?: string[];
    }[]
  >([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Funkcja do pobierania modeli z API providera
  const fetchModelsFromProvider = async () => {
    // Dla lokalnych providerów nie wymagamy API key
    if (!formData.apiKey && formData.provider !== "local") {
      setModelsError("Podaj klucz API aby pobrać listę modeli");
      return;
    }

    setLoadingModels(true);
    setModelsError(null);
    setDynamicModels([]);

    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/fetch-models`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: formData.provider,
            apiKey: formData.apiKey,
            baseUrl: formData.baseUrl || undefined,
          }),
        }
      );

      const data = await response.json();

      if (data.success && data.models) {
        setDynamicModels(data.models);
      } else {
        setModelsError(data.error || "Nie udało się pobrać modeli");
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      setModelsError("Błąd połączenia z API");
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        provider: editingConfig.provider,
        name: editingConfig.name,
        apiKey: "",
        baseUrl: editingConfig.base_url || "",
        chatEndpoint: "",
        embeddingsEndpoint: "",
        modelsEndpoint: "",
        modelName: editingConfig.model_name || "",
        visionModel: "",
        embeddingModel: "text-embedding-3-small",
        transcriptionModel: "whisper-1",
      });
    } else {
      setFormData({
        provider: "openai" as ProviderType,
        name: "",
        apiKey: "",
        baseUrl: "",
        chatEndpoint: "",
        embeddingsEndpoint: "",
        modelsEndpoint: "",
        modelName: "",
        visionModel: "",
        embeddingModel: "text-embedding-3-small",
        transcriptionModel: "whisper-1",
      });
    }
    setError(null);
  }, [editingConfig, isOpen]);

  const handleSave = async () => {
    // Walidacja
    if (!formData.name.trim()) {
      setError("Nazwa konfiguracji jest wymagana");
      return;
    }

    if (!formData.apiKey && !editingConfig) {
      setError("Klucz API jest wymagany");
      return;
    }

    // Base URL jest opcjonalny - może być pusty i zostanie użyty domyślny

    try {
      setSaving(true);
      setError(null);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">
              {editingConfig ? "Edytuj konfigurację" : "Nowa konfiguracja API"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
            disabled={saving}
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-xl text-red-900 text-sm flex items-start gap-3 shadow-sm">
              <svg
                className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Provider Selector */}
          <ProviderSelector
            value={formData.provider}
            onChange={(provider) => setFormData({ ...formData, provider })}
            disabled={saving}
          />

          {/* Name */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-xl border border-gray-200">
            <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <svg
                className="h-4 w-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              Nazwa konfiguracji
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              disabled={saving}
              placeholder="np. OpenAI GPT-4, Google Gemini Pro"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed bg-white shadow-sm"
            />
          </div>

          {/* Credentials Input */}
          <CredentialsInput
            value={formData.apiKey}
            onChange={(apiKey) => setFormData({ ...formData, apiKey })}
            provider={formData.provider}
            disabled={saving}
            error={error ?? undefined}
          />

          {/* Endpoint Config */}
          <EndpointConfig
            provider={formData.provider}
            baseUrl={formData.baseUrl}
            chatEndpoint={formData.chatEndpoint}
            embeddingsEndpoint={formData.embeddingsEndpoint}
            modelsEndpoint={formData.modelsEndpoint}
            onBaseUrlChange={(baseUrl) => setFormData({ ...formData, baseUrl })}
            onChatEndpointChange={(chatEndpoint) =>
              setFormData({ ...formData, chatEndpoint })
            }
            onEmbeddingsEndpointChange={(embeddingsEndpoint) =>
              setFormData({ ...formData, embeddingsEndpoint })
            }
            onModelsEndpointChange={(modelsEndpoint) =>
              setFormData({ ...formData, modelsEndpoint })
            }
            disabled={saving}
          />

          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Model Chat
            </label>
            <div className="flex gap-2">
              <select
                value={formData.modelName}
                onChange={(e) =>
                  setFormData({ ...formData, modelName: e.target.value })
                }
                disabled={saving}
                className="flex-1 px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
              >
                <option value="">Wybierz model...</option>
                {/* Dynamiczne modele z API z metadanymi */}
                {dynamicModels.length > 0 && (
                  <optgroup label="📡 Pobrane z API">
                    {dynamicModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name || model.id}
                        {model.badges &&
                          model.badges.length > 0 &&
                          ` ${model.badges.includes("cheapest") ? "💰" : ""}${
                            model.badges.includes("best-value") ? "⭐" : ""
                          }${model.badges.includes("fastest") ? "⚡" : ""}`}
                      </option>
                    ))}
                  </optgroup>
                )}
                {/* Predefiniowane modele jako fallback */}
                {dynamicModels.length === 0 &&
                  formData.provider === "openai" && (
                    <>
                      <optgroup label="GPT-4o">
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                      </optgroup>
                      <optgroup label="GPT-4">
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-4">GPT-4</option>
                      </optgroup>
                      <optgroup label="GPT-3.5">
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </optgroup>
                    </>
                  )}
                {dynamicModels.length === 0 &&
                  formData.provider === "local" && (
                    <optgroup label="Lokalne modele">
                      <option value="llama3.2">Llama 3.2</option>
                      <option value="llama3.1">Llama 3.1</option>
                      <option value="mistral">Mistral</option>
                      <option value="mixtral">Mixtral</option>
                      <option value="qwen2.5">Qwen 2.5</option>
                      <option value="deepseek-r1">DeepSeek R1</option>
                    </optgroup>
                  )}
                {dynamicModels.length === 0 &&
                  formData.provider === "other" && (
                    <optgroup label="Custom">
                      <option value="">Wpisz nazwę modelu poniżej</option>
                    </optgroup>
                  )}
              </select>
              <button
                type="button"
                onClick={fetchModelsFromProvider}
                disabled={
                  (!formData.apiKey && formData.provider !== "local") ||
                  loadingModels ||
                  saving
                }
                className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                title="Pobierz listę modeli z API"
              >
                {loadingModels ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
            {modelsError && (
              <p className="mt-1 text-xs text-red-500">{modelsError}</p>
            )}
            {dynamicModels.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-green-600">
                  ✓ Załadowano {dynamicModels.length} modeli z metadanymi
                </p>
                <div className="flex gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    💰 = Najtańszy
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="h-3 w-3" />⭐ = Jakość/Cena
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />⚡ = Najszybszy
                  </span>
                </div>
              </div>
            )}
            <input
              type="text"
              value={formData.modelName}
              onChange={(e) =>
                setFormData({ ...formData, modelName: e.target.value })
              }
              disabled={saving}
              placeholder="Lub wpisz nazwę modelu ręcznie..."
              className="w-full mt-2 px-4 py-2 border border-secondary-200 bg-secondary-50 rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Kliknij 🔄 aby pobrać modele z metadanymi (koszty, wydajność)
            </p>
          </div>

          {/* Embedding Model */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Model Embedding
            </label>
            <select
              value={formData.embeddingModel}
              onChange={(e) =>
                setFormData({ ...formData, embeddingModel: e.target.value })
              }
              disabled={saving}
              className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
            >
              {formData.provider === "openai" && (
                <>
                  <option value="text-embedding-3-small">
                    text-embedding-3-small (zalecany, 1536 dim)
                  </option>
                  <option value="text-embedding-3-large">
                    text-embedding-3-large (dokładniejszy, 3072 dim)
                  </option>
                  <option value="text-embedding-ada-002">
                    text-embedding-ada-002 (legacy, 1536 dim)
                  </option>
                </>
              )}
              {formData.provider === "local" && (
                <>
                  <option value="nomic-embed-text">nomic-embed-text</option>
                  <option value="mxbai-embed-large">mxbai-embed-large</option>
                  <option value="all-minilm">all-minilm</option>
                </>
              )}
              {formData.provider === "other" && (
                <option value="text-embedding-3-small">
                  text-embedding-3-small (compatible)
                </option>
              )}
            </select>
            <p className="mt-1 text-xs text-text-secondary">
              Używany do generowania embeddingów dla RAG i wyszukiwania
              semantycznego
            </p>
          </div>

          {/* Transcription Model */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Model Transkrypcji
            </label>
            <select
              value={formData.transcriptionModel}
              onChange={(e) =>
                setFormData({ ...formData, transcriptionModel: e.target.value })
              }
              disabled={saving}
              className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
            >
              {formData.provider === "openai" && (
                <option value="whisper-1">whisper-1 (OpenAI Whisper)</option>
              )}
              {formData.provider === "local" && (
                <>
                  <option value="whisper-1">whisper-1 (compatible)</option>
                  <option value="whisper-large-v3">
                    whisper-large-v3 (local)
                  </option>
                </>
              )}
              {formData.provider === "other" && (
                <option value="whisper-1">whisper-1 (compatible)</option>
              )}
            </select>
            <p className="mt-1 text-xs text-text-secondary">
              Używany do transkrypcji audio z YouTube i innych źródeł
            </p>
          </div>

          {/* Connection Tester */}
          {formData.apiKey && formData.baseUrl && (
            <ConnectionTester
              configId={editingConfig?.id}
              provider={formData.provider}
              apiKey={formData.apiKey}
              baseUrl={formData.baseUrl}
              disabled={saving}
            />
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-blue-50 border-t-2 border-gray-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-3xl shadow-lg">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-white hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!formData.apiKey && !editingConfig)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Zapisywanie...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {editingConfig ? "Zapisz zmiany" : "Dodaj konfigurację"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
