"use client";

import { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  Settings2,
  Zap,
  Edit,
  AlertCircle,
  Star,
  RefreshCw,
  DollarSign,
  Zap as ZapIcon,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import {
  getApiConfigurations,
  createApiConfiguration,
  updateApiConfiguration,
  deleteApiConfiguration,
  setDefaultApiConfiguration,
  toggleApiConfigurationActive,
  type ApiConfiguration,
} from "@/lib/supabase/api-config";
import { ProviderType } from "@aasystent-radnego/shared";
import {
  AIConfigurationModal,
  type AIConfigFormData,
} from "@/components/providers/AIConfigurationModal";
import {
  SemanticSearchModal,
  type SemanticConfigFormData,
} from "@/components/providers/SemanticSearchModal";

// Funkcje pomocnicze dla providerów - tylko OpenAI API compatible
const getApiUrlPlaceholder = (provider: string): string => {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    local: "http://localhost:11434/v1",
    other: "https://api.example.com/v1",
  };
  return urls[provider] || "https://api.example.com/v1";
};

const getApiUrlHint = (provider: string): string => {
  const hints: Record<string, string> = {
    openai: "Oficjalne OpenAI API",
    local: "Ollama (localhost:11434), LM Studio (localhost:1234), vLLM",
    other: "Dowolny endpoint zgodny z OpenAI API",
  };
  return hints[provider] || "Wprowadź URL API providera";
};

const getModelsForProvider = (
  provider: string
): { group: string; models: { value: string; label: string }[] }[] => {
  const modelsByProvider: Record<
    string,
    { group: string; models: { value: string; label: string }[] }[]
  > = {
    openai: [
      {
        group: "GPT-4o",
        models: [
          { value: "gpt-4o", label: "GPT-4o (najnowszy)" },
          { value: "gpt-4o-mini", label: "GPT-4o Mini (tani)" },
        ],
      },
      {
        group: "GPT-4",
        models: [
          { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
          { value: "gpt-4", label: "GPT-4" },
        ],
      },
      {
        group: "GPT-3.5",
        models: [{ value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }],
      },
    ],
    local: [
      {
        group: "Lokalne modele",
        models: [
          { value: "llama3.2", label: "Llama 3.2" },
          { value: "llama3.1", label: "Llama 3.1" },
          { value: "mistral", label: "Mistral" },
          { value: "mixtral", label: "Mixtral" },
          { value: "qwen2.5", label: "Qwen 2.5" },
          { value: "deepseek-r1", label: "DeepSeek R1" },
          { value: "codellama", label: "Code Llama" },
        ],
      },
    ],
    other: [
      {
        group: "Custom",
        models: [{ value: "", label: "Wpisz nazwę modelu" }],
      },
    ],
  };
  return (
    modelsByProvider[provider] || [
      { group: "Modele", models: [{ value: "", label: "Wpisz nazwę modelu" }] },
    ]
  );
};

const getProviderLabel = (provider: string): string => {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    local: "Lokalny model (Ollama/LM Studio)",
    other: "Inny (OpenAI API compatible)",
  };
  return labels[provider] || provider;
};

const getEmbeddingModels = (
  provider: string
): { value: string; label: string }[] => {
  const embeddingsByProvider: Record<
    string,
    { value: string; label: string }[]
  > = {
    openai: [
      {
        value: "text-embedding-3-small",
        label: "text-embedding-3-small (zalecany, 1536 dim)",
      },
      {
        value: "text-embedding-3-large",
        label: "text-embedding-3-large (dokładniejszy, 3072 dim)",
      },
      {
        value: "text-embedding-ada-002",
        label: "text-embedding-ada-002 (starszy, 1536 dim)",
      },
    ],
    local: [
      { value: "nomic-embed-text", label: "Nomic Embed Text (Ollama)" },
      { value: "mxbai-embed-large", label: "MxBai Embed Large (Ollama)" },
      { value: "all-minilm", label: "All-MiniLM (Ollama)" },
    ],
    other: [
      {
        value: "text-embedding-3-small",
        label: "text-embedding-3-small (compatible)",
      },
    ],
  };
  return (
    embeddingsByProvider[provider] || [
      { value: "text-embedding-3-small", label: "OpenAI Compatible" },
    ]
  );
};

export default function ApiSettingsPage() {
  const [configs, setConfigs] = useState<ApiConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSemanticModal, setShowSemanticModal] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfiguration | null>(
    null
  );
  const [formData, setFormData] = useState<AIConfigFormData>({
    provider: "openai",
    name: "",
    apiKey: "",
    baseUrl: "",
    modelName: "",
    embeddingModel: "text-embedding-3-small",
    transcriptionModel: "whisper-1",
    visionModel: "",
  });

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
    if (!formData.apiKey) {
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
        setMessage({
          type: "success",
          text: `Pobrano ${data.models.length} modeli z metadanymi`,
        });
        setTimeout(() => setMessage(null), 3000);
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

  // Pobierz konfiguracje przy montowaniu
  useEffect(() => {
    async function loadConfigurations() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setMessage({ type: "error", text: "Nie jesteś zalogowany" });
          setLoading(false);
          return;
        }

        setUserId(user.id);
        const configurations = await getApiConfigurations(user.id);
        setConfigs(configurations);
      } catch (error) {
        console.error("Error loading API configurations:", error);
        setMessage({
          type: "error",
          text: "Błąd podczas ładowania konfiguracji",
        });
      } finally {
        setLoading(false);
      }
    }

    loadConfigurations();
  }, []);

  const handleOpenAddModal = () => {
    setEditingConfig(null);
    setShowTypePicker(true);
  };

  const handleOpenEditModal = (config: ApiConfiguration) => {
    setEditingConfig(config);
    if (config.config_type === "semantic") {
      setShowSemanticModal(true);
    } else {
      setFormData({
        provider: config.provider as ProviderType,
        name: config.name,
        apiKey: "",
        baseUrl: config.base_url || "",
        modelName: config.model_name || "",
        embeddingModel:
          (config as ApiConfiguration & { embedding_model?: string })
            .embedding_model || "text-embedding-3-small",
        transcriptionModel:
          (config as ApiConfiguration & { transcription_model?: string })
            .transcription_model || "whisper-1",
        visionModel:
          (config.provider_meta as { vision_model?: string } | null)
            ?.vision_model || "",
      });
      setShowModal(true);
    }
  };

  const handleSelectType = (type: "ai" | "semantic") => {
    setShowTypePicker(false);
    setEditingConfig(null);
    if (type === "semantic") {
      setShowSemanticModal(true);
    } else {
      setFormData({
        provider: "openai",
        name: "",
        apiKey: "",
        baseUrl: "",
        modelName: "",
        embeddingModel: "text-embedding-3-small",
        transcriptionModel: "whisper-1",
        visionModel: "",
      });
      setShowModal(true);
    }
  };

  const handleSaveConfig = async (configData?: AIConfigFormData) => {
    if (!userId) return;

    const dataToSave = configData || formData;
    setSaving(true);
    setMessage(null);

    try {
      if (editingConfig) {
        // Edycja istniejącej konfiguracji
        const updates: Record<
          string,
          string | boolean | number | Record<string, unknown> | null | undefined
        > = {
          name: dataToSave.name,
          base_url: dataToSave.baseUrl,
          model_name: dataToSave.modelName,
          embedding_model: dataToSave.embeddingModel,
          transcription_model: dataToSave.transcriptionModel,
          vision_model: dataToSave.visionModel || null,
          tts_model: dataToSave.ttsModel || null,
          provider_meta: {
            llm_enabled: dataToSave.llmEnabled,
            embeddings_enabled: dataToSave.embeddingsEnabled,
            vision_enabled: dataToSave.visionEnabled,
            stt_enabled: dataToSave.sttEnabled,
            tts_enabled: dataToSave.ttsEnabled,
          },
          config_type: "ai",
        };

        // Tylko jeśli podano nowy klucz API
        if (dataToSave.apiKey) {
          updates.api_key = dataToSave.apiKey;
        }

        const result = await updateApiConfiguration(editingConfig.id, updates);
        if (result) {
          setConfigs(configs.map((c) => (c.id === result.id ? result : c)));
          setMessage({
            type: "success",
            text: "Konfiguracja została zaktualizowana",
          });
          setShowModal(false);
        } else {
          setMessage({
            type: "error",
            text: "Nie udało się zaktualizować konfiguracji",
          });
        }
      } else {
        // Dodawanie nowej konfiguracji
        const result = await createApiConfiguration(userId, {
          provider: dataToSave.provider,
          config_type: "ai",
          name: dataToSave.name,
          api_key: dataToSave.apiKey,
          base_url: dataToSave.baseUrl,
          model_name: dataToSave.modelName,
          embedding_model: dataToSave.embeddingModel,
          transcription_model: dataToSave.transcriptionModel,
          vision_model: dataToSave.visionModel,
          provider_meta: {
            llm_enabled: dataToSave.llmEnabled,
            embeddings_enabled: dataToSave.embeddingsEnabled,
            vision_enabled: dataToSave.visionEnabled,
            stt_enabled: dataToSave.sttEnabled,
            tts_enabled: dataToSave.ttsEnabled,
          },
          is_default: configs.length === 0,
        });

        if (result) {
          setConfigs([...configs, result]);
          setMessage({ type: "success", text: "Konfiguracja została dodana" });
          setShowModal(false);
        } else {
          setMessage({
            type: "error",
            text: "Nie udało się dodać konfiguracji",
          });
        }
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving configuration:", error);
      setMessage({ type: "error", text: "Wystąpił błąd podczas zapisywania" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSemanticConfig = async (data: SemanticConfigFormData) => {
    if (!userId) return;
    setSaving(true);
    setMessage(null);

    try {
      if (editingConfig && editingConfig.config_type === "semantic") {
        const updates: Record<
          string,
          string | number | boolean | Record<string, unknown> | undefined
        > = {
          name: data.name,
          provider: data.provider as string,
          config_type: "semantic",
          base_url: data.baseUrl,
          search_endpoint: data.searchEndpoint,
          results_limit: data.resultsLimit,
        };
        if (data.apiKey) updates.api_key = data.apiKey;
        const result = await updateApiConfiguration(editingConfig.id, updates);
        if (result) {
          setConfigs(configs.map((c) => (c.id === result.id ? result : c)));
          setMessage({
            type: "success",
            text: "Konfiguracja została zaktualizowana",
          });
        } else {
          setMessage({
            type: "error",
            text: "Nie udało się zaktualizować konfiguracji",
          });
        }
      } else {
        const result = await createApiConfiguration(userId, {
          provider: data.provider,
          config_type: "semantic",
          name: data.name,
          api_key: data.apiKey,
          base_url: data.baseUrl,
          search_endpoint: data.searchEndpoint,
          results_limit: data.resultsLimit,
          is_default: configs.length === 0,
        });
        if (result) {
          setConfigs([...configs, result]);
          setMessage({ type: "success", text: "Konfiguracja została dodana" });
        } else {
          setMessage({
            type: "error",
            text: "Nie udało się dodać konfiguracji",
          });
        }
      }
      setShowSemanticModal(false);
      setEditingConfig(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Error saving semantic configuration:", err);
      setMessage({ type: "error", text: "Wystąpił błąd podczas zapisywania" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę konfigurację?")) return;

    setSaving(true);
    setMessage(null);

    try {
      const success = await deleteApiConfiguration(id);
      if (success) {
        setConfigs(configs.filter((c) => c.id !== id));
        setMessage({ type: "success", text: "Konfiguracja została usunięta" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({
          type: "error",
          text: "Nie udało się usunąć konfiguracji",
        });
      }
    } catch (error) {
      console.error("Error deleting configuration:", error);
      setMessage({ type: "error", text: "Wystąpił błąd podczas usuwania" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!userId) return;

    setSaving(true);
    setMessage(null);

    try {
      const success = await setDefaultApiConfiguration(userId, id);
      if (success) {
        setConfigs(
          configs.map((c) => ({
            ...c,
            is_default: c.id === id,
          }))
        );
        setMessage({ type: "success", text: "Ustawiono jako domyślną" });
        setTimeout(() => setMessage(null), 2000);
      } else {
        setMessage({
          type: "error",
          text: "Nie udało się ustawić jako domyślną",
        });
      }
    } catch (error) {
      console.error("Error setting default:", error);
      setMessage({ type: "error", text: "Wystąpił błąd" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    setSaving(true);
    setMessage(null);

    try {
      const success = await toggleApiConfigurationActive(id, !currentState);
      if (success) {
        setConfigs(
          configs.map((c) =>
            c.id === id ? { ...c, is_active: !currentState } : c
          )
        );
        setMessage({
          type: "success",
          text: currentState ? "Dezaktywowano" : "Aktywowano",
        });
        setTimeout(() => setMessage(null), 2000);
      } else {
        setMessage({ type: "error", text: "Nie udało się zmienić statusu" });
      }
    } catch (error) {
      console.error("Error toggling active:", error);
      setMessage({ type: "error", text: "Wystąpił błąd" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    const config = configs.find((c) => c.id === id);
    if (!config) return;

    setSaving(true);
    setMessage({ type: "success", text: "Testowanie połączenia..." });

    try {
      // Najpierw odśwież sesję aby mieć aktualny token
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();

      if (refreshError) {
        console.error(
          "[handleTestConnection] Session refresh error:",
          refreshError
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      console.log(
        "[handleTestConnection] Token status:",
        token ? "present" : "missing"
      );

      if (!token) {
        setMessage({
          type: "error",
          text: "Brak tokena autoryzacji - zaloguj się ponownie",
        });
        setSaving(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/test/connection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          config_id: id,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const result = data.result;

      if (result.status === "success") {
        setMessage({
          type: "success",
          text: `✓ Połączenie udane (${result.response_time_ms}ms)`,
        });
      } else {
        setMessage({
          type: "error",
          text: `✗ ${result.error_message || "Test nieudany"}`,
        });
      }

      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error("Test connection error:", error);
      setMessage({
        type: "error",
        text: "Nie można połączyć się z serwerem API",
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-text-secondary">Ładowanie konfiguracji...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Message */}
      {message && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 ${
            message.type === "success"
              ? "bg-success/20 text-success border border-success/30"
              : "bg-danger/20 text-danger border border-danger/30"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <p className="font-medium">{message.text}</p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Key className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-700 bg-clip-text text-transparent">
              Konfiguracja API
            </h1>
            <p className="text-text-secondary mt-2 text-base font-medium">
              Zarządzaj kluczami API dla OpenAI i lokalnych modeli AI
            </p>
          </div>
        </div>
        <Button onClick={handleOpenAddModal} disabled={saving}>
          <Plus className="h-5 w-5 mr-2" />
          Dodaj konfigurację
        </Button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 mb-2">
              Automatyczne przełączanie
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              System automatycznie przełącza się między konfiguracjami w
              przypadku błędów lub przekroczenia limitów. Konfiguracje są
              używane według priorytetu.
            </p>
          </div>
        </div>
      </div>

      {/* Lista konfiguracji */}
      <div className="space-y-4">
        {configs.length === 0 ? (
          <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-12 text-center">
            <div className="h-20 w-20 rounded-2xl bg-secondary-100 flex items-center justify-center mx-auto mb-4">
              <Key className="h-10 w-10 text-secondary-400" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">
              Brak konfiguracji API
            </h3>
            <p className="text-text-secondary mb-6">
              Dodaj pierwszą konfigurację, aby korzystać z funkcji AI
            </p>
            <Button onClick={handleOpenAddModal} disabled={saving}>
              <Plus className="h-5 w-5 mr-2" />
              Dodaj konfigurację
            </Button>
          </div>
        ) : (
          configs.map((config) => (
            <div
              key={config.id}
              className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      config.provider === "openai"
                        ? "bg-gradient-to-br from-green-500 to-emerald-600"
                        : "bg-gradient-to-br from-blue-500 to-cyan-600"
                    }`}
                  >
                    <Settings2 className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-text">
                        {config.name}
                      </h3>
                      {config.is_default && (
                        <span className="px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
                          Domyślna
                        </span>
                      )}
                      {config.is_active ? (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-success/20 text-success text-xs font-semibold">
                          <CheckCircle className="h-3 w-3" />
                          Aktywna
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-secondary-200 text-secondary-700 text-xs font-semibold">
                          <XCircle className="h-3 w-3" />
                          Nieaktywna
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-text-secondary">
                      <p>
                        <span className="font-semibold">Provider:</span>{" "}
                        {getProviderLabel(config.provider)}
                      </p>
                      {config.base_url && (
                        <p>
                          <span className="font-semibold">URL:</span>{" "}
                          {config.base_url}
                        </p>
                      )}
                      {config.model_name && (
                        <p>
                          <span className="font-semibold">Model:</span>{" "}
                          {config.model_name}
                        </p>
                      )}
                      {config.last_used_at && (
                        <p>
                          <span className="font-semibold">
                            Ostatnie użycie:
                          </span>{" "}
                          {new Date(config.last_used_at).toLocaleString(
                            "pl-PL"
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!config.is_default && (
                    <button
                      onClick={() => handleSetDefault(config.id)}
                      className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors"
                      title="Ustaw jako domyślną"
                      disabled={saving}
                    >
                      <Star className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      handleToggleActive(config.id, config.is_active)
                    }
                    className={`p-2 rounded-lg transition-colors ${
                      config.is_active
                        ? "text-secondary-600 hover:bg-secondary-100"
                        : "text-success hover:bg-green-50"
                    }`}
                    title={config.is_active ? "Dezaktywuj" : "Aktywuj"}
                    disabled={saving}
                  >
                    {config.is_active ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(config)}
                    className="p-2 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Edytuj"
                    disabled={saving}
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleTestConnection(config.id)}
                    className="p-2 rounded-lg text-secondary-600 hover:bg-secondary-100 transition-colors"
                    title="Test połączenia"
                    disabled={saving}
                  >
                    <TestTube className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteConfig(config.id)}
                    className="p-2 rounded-lg text-danger hover:bg-red-50 transition-colors"
                    title="Usuń"
                    disabled={saving || config.is_default}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal dodawania/edycji konfiguracji AI */}
      <AIConfigurationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={async (config: AIConfigFormData) => {
          await handleSaveConfig(config);
        }}
        editingConfig={
          editingConfig && editingConfig.config_type === "ai"
            ? {
                id: editingConfig.id,
                provider: editingConfig.provider,
                name: editingConfig.name,
                base_url: editingConfig.base_url ?? null,
                model_name: editingConfig.model_name ?? null,
                embedding_model: editingConfig.embedding_model ?? null,
                transcription_model: editingConfig.transcription_model ?? null,
                vision_model:
                  (
                    editingConfig as ApiConfiguration & {
                      vision_model?: string;
                    }
                  ).vision_model ?? null,
                tts_model:
                  (editingConfig as ApiConfiguration & { tts_model?: string })
                    .tts_model ?? null,
                provider_meta: editingConfig.provider_meta as {
                  llm_enabled?: boolean;
                  embeddings_enabled?: boolean;
                  vision_enabled?: boolean;
                  stt_enabled?: boolean;
                  tts_enabled?: boolean;
                } | null,
              }
            : null
        }
      />

      {/* Semantic Search Modal */}
      <SemanticSearchModal
        isOpen={showSemanticModal}
        onClose={() => setShowSemanticModal(false)}
        onSave={handleSaveSemanticConfig}
        editingConfig={
          editingConfig && editingConfig.config_type === "semantic"
            ? {
                id: editingConfig.id,
                provider: editingConfig.provider as
                  | "exa"
                  | "perplexity"
                  | "tavily"
                  | "brave",
                name: editingConfig.name,
                base_url: editingConfig.base_url ?? null,
                search_endpoint: editingConfig.search_endpoint ?? null,
                results_limit: editingConfig.results_limit ?? null,
              }
            : null
        }
      />

      {/* Type Picker Modal */}
      {showTypePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              Wybierz typ konfiguracji
            </h2>
            <div className="space-y-3">
              <button
                onClick={() => handleSelectType("ai")}
                className="w-full p-4 border-2 border-secondary-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
              >
                <div className="font-semibold text-lg">AI Provider</div>
                <div className="text-sm text-text-secondary mt-1">
                  OpenAI, Ollama, Azure, Anthropic, inne LLM
                </div>
              </button>
              <button
                onClick={() => handleSelectType("semantic")}
                className="w-full p-4 border-2 border-secondary-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
              >
                <div className="font-semibold text-lg">Semantic Search</div>
                <div className="text-sm text-text-secondary mt-1">
                  Exa, Brave, Perplexity, Tavily - wyszukiwanie semantyczne
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowTypePicker(false)}
              className="mt-4 w-full px-4 py-2 border border-secondary-300 rounded-xl hover:bg-secondary-50 transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Stary modal - do usunięcia po testach */}
      {false && showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-secondary-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingConfig
                ? "Edytuj konfigurację API"
                : "Dodaj konfigurację API"}
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Provider
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      provider: e.target.value as ProviderType,
                    })
                  }
                  disabled={!!editingConfig}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <optgroup label="OpenAI i kompatybilne">
                    <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
                    <option value="azure">Azure OpenAI</option>
                    <option value="local">
                      Lokalny model (Ollama, LM Studio)
                    </option>
                  </optgroup>
                  <optgroup label="Anthropic">
                    <option value="anthropic">Anthropic Claude</option>
                  </optgroup>
                  <optgroup label="Google">
                    <option value="google">Google Gemini</option>
                  </optgroup>
                  <optgroup label="Chińscy providerzy">
                    <option value="moonshot">Moonshot AI (Kimi K2)</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="qwen">Alibaba Qwen</option>
                    <option value="zhipu">Zhipu AI (GLM)</option>
                    <option value="baichuan">Baichuan</option>
                  </optgroup>
                  <optgroup label="Inni providerzy">
                    <option value="mistral">Mistral AI</option>
                    <option value="cohere">Cohere</option>
                    <option value="together">Together AI</option>
                    <option value="groq">Groq</option>
                    <option value="other">Inny (OpenAI-compatible)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nazwa konfiguracji
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="np. OpenAI GPT-4, Kimi K2, DeepSeek"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Klucz API
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  placeholder={
                    editingConfig
                      ? "Pozostaw puste, aby nie zmieniać"
                      : "sk-... lub inny format klucza"
                  }
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {editingConfig
                    ? "Podaj nowy klucz tylko jeśli chcesz go zmienić. Zostanie zaszyfrowany."
                    : "Klucz będzie zaszyfrowany i bezpiecznie przechowywany w bazie danych"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  URL API (opcjonalne)
                </label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, baseUrl: e.target.value })
                  }
                  placeholder={getApiUrlPlaceholder(formData.provider)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {getApiUrlHint(formData.provider)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Model AI (do czatu)
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.modelName}
                    onChange={(e) =>
                      setFormData({ ...formData, modelName: e.target.value })
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200"
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
                              ` ${
                                model.badges.includes("cheapest") ? "💰" : ""
                              }${
                                model.badges.includes("best-value") ? "⭐" : ""
                              }${model.badges.includes("fastest") ? "⚡" : ""}`}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {/* Statyczne modele jako fallback */}
                    {dynamicModels.length === 0 &&
                      getModelsForProvider(formData.provider).map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.models.map((model) => (
                            <option key={model.value} value={model.value}>
                              {model.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={fetchModelsFromProvider}
                    disabled={!formData.apiKey || loadingModels}
                    className="px-4 py-2.5 rounded-xl border-2 border-primary-200 bg-primary-50 text-primary-700 font-medium hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                    title="Pobierz aktualną listę modeli z API providera"
                  >
                    {loadingModels ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Skanuj</span>
                  </button>
                </div>
                {modelsError && (
                  <p className="text-xs text-red-500 mt-1">{modelsError}</p>
                )}
                {dynamicModels.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-green-600">
                      ✓ Załadowano {dynamicModels.length} modeli z metadanymi
                    </p>
                    <div className="flex gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        💰 = Najtańszy
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3" />⭐ = Jakość/Cena
                      </span>
                      <span className="flex items-center gap-1">
                        <ZapIcon className="h-3 w-3" />⚡ = Najszybszy
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Kliknij &quot;Skanuj&quot; aby pobrać modele z metadanymi
                  (koszty, wydajność)
                </p>
                <input
                  type="text"
                  value={formData.modelName}
                  onChange={(e) =>
                    setFormData({ ...formData, modelName: e.target.value })
                  }
                  placeholder="Lub wpisz nazwę modelu ręcznie..."
                  className="w-full mt-2 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Model Embeddings (do wyszukiwania)
                </label>
                <select
                  value={formData.embeddingModel}
                  onChange={(e) =>
                    setFormData({ ...formData, embeddingModel: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200"
                >
                  {getEmbeddingModels(formData.provider).map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Model używany do generowania wektorów dla wyszukiwania
                  semantycznego
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => handleSaveConfig()}
                  disabled={
                    !formData.name ||
                    (!formData.apiKey && !editingConfig) ||
                    saving
                  }
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Zapisywanie...
                    </>
                  ) : (
                    <>
                      {editingConfig ? (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Zapisz zmiany
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Dodaj konfigurację
                        </>
                      )}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
