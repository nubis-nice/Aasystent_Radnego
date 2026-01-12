import { supabase } from "./client";
import { ProviderType } from "@aasystent-radnego/shared";

export type ConfigType = "ai" | "semantic";

// Interfejsy TypeScript
export interface ApiConfiguration {
  id: string;
  user_id: string;
  provider: ProviderType | "exa" | "perplexity" | "tavily";
  config_type: ConfigType;
  name: string;
  api_key_encrypted: string;
  base_url?: string;
  model_name?: string;
  embedding_model?: string;
  transcription_model?: string;
  vision_model?: string;
  tts_model?: string;
  search_endpoint?: string;
  results_limit?: number;
  provider_meta?: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiConfigurationInput {
  provider: ProviderType | "exa" | "perplexity" | "tavily";
  config_type?: ConfigType;
  name: string;
  api_key: string; // Niezaszyfrowany klucz (będzie zaszyfrowany na backendzie)
  base_url?: string;
  model_name?: string;
  embedding_model?: string;
  transcription_model?: string;
  vision_model?: string;
  search_endpoint?: string;
  results_limit?: number;
  provider_meta?: Record<string, unknown>;
  is_active?: boolean;
  is_default?: boolean;
}

export interface ApiConfigurationUpdate {
  name?: string;
  api_key?: string; // Jeśli podany, zostanie zaszyfrowany
  base_url?: string;
  model_name?: string;
  embedding_model?: string;
  transcription_model?: string;
  vision_model?: string | null;
  tts_model?: string | null;
  config_type?: ConfigType;
  search_endpoint?: string;
  results_limit?: number;
  provider_meta?: Record<string, unknown>;
  is_active?: boolean;
  is_default?: boolean;
}

// Funkcje CRUD

/**
 * Pobierz wszystkie konfiguracje API użytkownika
 */
export async function getApiConfigurations(
  userId: string
): Promise<ApiConfiguration[]> {
  const { data, error } = await supabase
    .from("api_configurations")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching API configurations:", error);
    return [];
  }

  return data || [];
}

/**
 * Pobierz pojedynczą konfigurację API
 */
export async function getApiConfiguration(
  configId: string
): Promise<ApiConfiguration | null> {
  const { data, error } = await supabase
    .from("api_configurations")
    .select("*")
    .eq("id", configId)
    .single();

  if (error) {
    console.error("Error fetching API configuration:", error);
    return null;
  }

  return data;
}

/**
 * Pobierz domyślną konfigurację API użytkownika
 */
export async function getDefaultApiConfiguration(
  userId: string
): Promise<ApiConfiguration | null> {
  const { data, error } = await supabase
    .from("api_configurations")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("Error fetching default API configuration:", error);
    return null;
  }

  return data;
}

/**
 * Utwórz nową konfigurację API
 * UWAGA: W produkcji klucz API powinien być szyfrowany po stronie backendu
 * Tymczasowo przechowujemy jako base64 (NIE JEST TO BEZPIECZNE dla produkcji)
 */
export async function createApiConfiguration(
  userId: string,
  config: ApiConfigurationInput
): Promise<ApiConfiguration | null> {
  // Bezpieczne kodowanie base64 - obsługuje znaki Unicode i specjalne
  const apiKeyEncrypted = btoa(unescape(encodeURIComponent(config.api_key)));

  const { data, error } = await supabase
    .from("api_configurations")
    .insert({
      user_id: userId,
      provider: config.provider,
      config_type: config.config_type ?? "ai",
      name: config.name,
      api_key_encrypted: apiKeyEncrypted,
      base_url: config.base_url,
      model_name: config.model_name,
      embedding_model: config.embedding_model,
      transcription_model: config.transcription_model,
      search_endpoint: config.search_endpoint,
      results_limit: config.results_limit,
      provider_meta: config.provider_meta,
      is_active: config.is_active ?? true,
      is_default: config.is_default ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error(
      "Error creating API configuration:",
      JSON.stringify(error, null, 2)
    );
    console.error(
      "Error details:",
      error.message,
      error.code,
      error.details,
      error.hint
    );
    return null;
  }

  return data;
}

/**
 * Zaktualizuj konfigurację API
 */
export async function updateApiConfiguration(
  configId: string,
  updates: ApiConfigurationUpdate
): Promise<ApiConfiguration | null> {
  const updateData: Record<
    string,
    string | boolean | number | Record<string, unknown> | undefined | null
  > = {
    ...updates,
  };

  // Jeśli podano nowy klucz API, "zaszyfruj" go
  if (updates.api_key) {
    updateData.api_key_encrypted = btoa(
      unescape(encodeURIComponent(updates.api_key))
    );
    delete updateData.api_key;
  }

  const { data, error } = await supabase
    .from("api_configurations")
    .update(updateData)
    .eq("id", configId)
    .select()
    .single();

  if (error) {
    console.error("Error updating API configuration:", error);
    return null;
  }

  return data;
}

/**
 * Usuń konfigurację API
 */
export async function deleteApiConfiguration(
  configId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("api_configurations")
    .delete()
    .eq("id", configId);

  if (error) {
    console.error("Error deleting API configuration:", error);
    return false;
  }

  return true;
}

/**
 * Ustaw konfigurację jako domyślną
 */
export async function setDefaultApiConfiguration(
  userId: string,
  configId: string
): Promise<boolean> {
  // Trigger w bazie danych automatycznie ustawi is_default=false dla innych
  const { error } = await supabase
    .from("api_configurations")
    .update({ is_default: true })
    .eq("id", configId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error setting default API configuration:", error);
    return false;
  }

  return true;
}

/**
 * Przełącz aktywność konfiguracji
 */
export async function toggleApiConfigurationActive(
  configId: string,
  isActive: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("api_configurations")
    .update({ is_active: isActive })
    .eq("id", configId);

  if (error) {
    console.error("Error toggling API configuration active:", error);
    return false;
  }

  return true;
}

/**
 * Zaktualizuj czas ostatniego użycia
 */
export async function updateLastUsedAt(configId: string): Promise<boolean> {
  const { error } = await supabase
    .from("api_configurations")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", configId);

  if (error) {
    console.error("Error updating last_used_at:", error);
    return false;
  }

  return true;
}

/**
 * Odszyfruj klucz API (tymczasowa implementacja)
 * W produkcji to powinno być wykonywane po stronie backendu
 */
export function decryptApiKey(encryptedKey: string): string {
  try {
    return atob(encryptedKey);
  } catch (error) {
    console.error("Error decrypting API key:", error);
    return "";
  }
}
