/**
 * API Key Resolver - Pobiera klucze API z bazy danych
 * 
 * Obsługuje pobieranie kluczy dla zewnętrznych serwisów:
 * - GUS (Bank Danych Lokalnych)
 * - Geoportal
 * - ISAP
 * - i innych
 */

import { supabase } from "../lib/supabase.js";
import { decryptApiKey } from "../utils/encryption.js";
import { Buffer } from "node:buffer";

export interface ResolvedApiConfig {
  apiKey: string;
  baseUrl: string;
  isActive: boolean;
}

/**
 * Pobiera klucz API dla danego providera z bazy danych
 */
export async function getApiKeyForProvider(
  userId: string,
  provider: string
): Promise<ResolvedApiConfig | null> {
  try {
    const { data: config, error } = await supabase
      .from("api_configurations")
      .select("api_key_encrypted, encryption_iv, base_url, is_active")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("is_active", true)
      .single();

    if (error || !config) {
      console.log(`[ApiKeyResolver] No config found for provider: ${provider}`);
      return null;
    }

    // Deszyfruj klucz API
    let decryptedKey: string;
    if (config.encryption_iv && config.encryption_iv.length > 0) {
      // Nowy format - AES-256-GCM
      decryptedKey = decryptApiKey(config.api_key_encrypted, config.encryption_iv);
    } else {
      // Stary format - base64
      decryptedKey = Buffer.from(config.api_key_encrypted, "base64").toString("utf-8");
    }

    return {
      apiKey: decryptedKey,
      baseUrl: config.base_url || "",
      isActive: config.is_active,
    };
  } catch (error) {
    console.error(`[ApiKeyResolver] Error getting API key for ${provider}:`, error);
    return null;
  }
}

/**
 * Pobiera klucz GUS API
 */
export async function getGUSApiKey(userId: string): Promise<string | null> {
  const config = await getApiKeyForProvider(userId, "gus");
  return config?.apiKey || null;
}

/**
 * Pobiera wszystkie aktywne konfiguracje API dla użytkownika
 */
export async function getAllActiveApiConfigs(userId: string): Promise<Map<string, ResolvedApiConfig>> {
  const configs = new Map<string, ResolvedApiConfig>();

  try {
    const { data, error } = await supabase
      .from("api_configurations")
      .select("provider, api_key_encrypted, encryption_iv, base_url, is_active")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error || !data) {
      return configs;
    }

    for (const config of data) {
      let decryptedKey: string;
      try {
        if (config.encryption_iv && config.encryption_iv.length > 0) {
          decryptedKey = decryptApiKey(config.api_key_encrypted, config.encryption_iv);
        } else {
          decryptedKey = Buffer.from(config.api_key_encrypted, "base64").toString("utf-8");
        }

        configs.set(config.provider, {
          apiKey: decryptedKey,
          baseUrl: config.base_url || "",
          isActive: config.is_active,
        });
      } catch {
        console.warn(`[ApiKeyResolver] Failed to decrypt key for provider: ${config.provider}`);
      }
    }
  } catch (error) {
    console.error("[ApiKeyResolver] Error getting all API configs:", error);
  }

  return configs;
}
