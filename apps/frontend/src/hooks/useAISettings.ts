/**
 * useAISettings - hook do pobierania ustawień AI użytkownika
 * Pobiera imię asystenta i inne ustawienia z user_ai_settings
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export interface AISettings {
  assistantName: string;
  responseStyle: "formal" | "casual" | "concise" | "detailed";
  personality: string;
  specialInstructions: string;
  temperature: number;
  maxTokens: number;
  includeEmoji: boolean;
  language: "pl" | "en";
}

const DEFAULT_SETTINGS: AISettings = {
  assistantName: "Asystent",
  responseStyle: "formal",
  personality: "",
  specialInstructions: "",
  temperature: 0.7,
  maxTokens: 2048,
  includeEmoji: false,
  language: "pl",
};

export interface UseAISettingsResult {
  settings: AISettings;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAISettings(): UseAISettingsResult {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSettings(DEFAULT_SETTINGS);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("user_ai_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        console.error("[useAISettings] Error fetching settings:", fetchError);
        setError("Błąd pobierania ustawień AI");
        return;
      }

      if (data) {
        setSettings({
          assistantName: data.assistant_name || DEFAULT_SETTINGS.assistantName,
          responseStyle: data.response_style || DEFAULT_SETTINGS.responseStyle,
          personality: data.personality || "",
          specialInstructions: data.special_instructions || "",
          temperature: data.temperature ?? DEFAULT_SETTINGS.temperature,
          maxTokens: data.max_tokens ?? DEFAULT_SETTINGS.maxTokens,
          includeEmoji: data.include_emoji ?? false,
          language: data.language || "pl",
        });
      }
    } catch (err) {
      console.error("[useAISettings] Unexpected error:", err);
      setError("Nieoczekiwany błąd");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
  };
}
