"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Save,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Zap,
  Mic,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface AIChatSettings {
  assistantName: string;
  responseStyle: "formal" | "casual" | "concise" | "detailed";
  personality: string;
  specialInstructions: string;
  temperature: number;
  maxTokens: number;
  includeEmoji: boolean;
  language: "pl" | "en";
}

const defaultSettings: AIChatSettings = {
  assistantName: "Asystent",
  responseStyle: "formal",
  personality: "",
  specialInstructions: "",
  temperature: 0.7,
  maxTokens: 2048,
  includeEmoji: false,
  language: "pl",
};

const responseStyleOptions = [
  {
    value: "formal",
    label: "Formalny",
    description: "Profesjonalny ton, odpowiedni dla dokumentów urzędowych",
  },
  {
    value: "casual",
    label: "Swobodny",
    description: "Przyjazny i bezpośredni styl komunikacji",
  },
  {
    value: "concise",
    label: "Zwięzły",
    description: "Krótkie, rzeczowe odpowiedzi bez zbędnych szczegółów",
  },
  {
    value: "detailed",
    label: "Szczegółowy",
    description: "Wyczerpujące odpowiedzi z pełnym kontekstem",
  },
];

export default function AIChatSettingsPage() {
  const [settings, setSettings] = useState<AIChatSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_ai_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setSettings({
          assistantName: data.assistant_name || defaultSettings.assistantName,
          responseStyle: data.response_style || defaultSettings.responseStyle,
          personality: data.personality || "",
          specialInstructions: data.special_instructions || "",
          temperature: data.temperature ?? defaultSettings.temperature,
          maxTokens: data.max_tokens ?? defaultSettings.maxTokens,
          includeEmoji: data.include_emoji ?? false,
          language: data.language || "pl",
        });
      }
    } catch (error) {
      console.error("Error loading AI settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("user_ai_settings").upsert(
        {
          user_id: user.id,
          assistant_name: settings.assistantName,
          response_style: settings.responseStyle,
          personality: settings.personality,
          special_instructions: settings.specialInstructions,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          include_emoji: settings.includeEmoji,
          language: settings.language,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      setMessage({ type: "success", text: "Ustawienia zostały zapisane" });
    } catch (error) {
      console.error("Error saving AI settings:", error);
      setMessage({ type: "error", text: "Błąd podczas zapisywania ustawień" });
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setSettings(defaultSettings);
    setMessage({
      type: "success",
      text: "Przywrócono ustawienia domyślne (niezapisane)",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-purple-700 bg-clip-text text-transparent">
            Personalizacja AI
          </h1>
        </div>
        <p className="text-text-secondary mt-2">
          Dostosuj zachowanie i styl odpowiedzi asystenta AI w czacie
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Assistant Name - for Voice Commands */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <Mic className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-bold text-text dark:text-text-dark">
            Imię asystenta
          </h2>
          <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-1 rounded-full">
            Voice Command
          </span>
        </div>
        <input
          type="text"
          value={settings.assistantName}
          onChange={(e) =>
            setSettings({ ...settings, assistantName: e.target.value })
          }
          placeholder="Np. Aria, Radek, Pomocnik..."
          className="w-full px-4 py-3 rounded-xl border border-border dark:border-border-dark bg-background dark:bg-secondary-900 text-text dark:text-text-dark placeholder-text-secondary focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-lg font-medium"
        />
        <p className="text-sm text-text-secondary mt-2">
          Nazwij swojego asystenta AI. To imię będzie używane w interakcjach
          głosowych - możesz powiedzieć np. &quot;Hej{" "}
          {settings.assistantName || "Asystent"}, znajdź uchwałę...&quot;
        </p>
      </div>

      {/* Response Style */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-bold text-text dark:text-text-dark">
            Styl odpowiedzi
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {responseStyleOptions.map((option) => (
            <label
              key={option.value}
              className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                settings.responseStyle === option.value
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                  : "border-border dark:border-border-dark hover:border-violet-300"
              }`}
            >
              <input
                type="radio"
                name="responseStyle"
                value={option.value}
                checked={settings.responseStyle === option.value}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    responseStyle: e.target
                      .value as AIChatSettings["responseStyle"],
                  })
                }
                className="sr-only"
              />
              <span className="font-semibold text-text dark:text-text-dark">
                {option.label}
              </span>
              <span className="text-sm text-text-secondary mt-1">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Personality */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-bold text-text dark:text-text-dark">
            Osobowość asystenta
          </h2>
        </div>
        <textarea
          value={settings.personality}
          onChange={(e) =>
            setSettings({ ...settings, personality: e.target.value })
          }
          placeholder="Np. Jestem doświadczonym radnym, który ceni rzetelne informacje i precyzyjne odpowiedzi..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-border dark:border-border-dark bg-background dark:bg-secondary-900 text-text dark:text-text-dark placeholder-text-secondary focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
        />
        <p className="text-sm text-text-secondary mt-2">
          Opisz, jak asystent powinien się zachowywać i komunikować
        </p>
      </div>

      {/* Special Instructions */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-bold text-text dark:text-text-dark">
            Specjalne instrukcje
          </h2>
        </div>
        <textarea
          value={settings.specialInstructions}
          onChange={(e) =>
            setSettings({ ...settings, specialInstructions: e.target.value })
          }
          placeholder="Np. Zawsze cytuj źródła prawne, używaj terminologii samorządowej, zwracaj uwagę na terminy..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-border dark:border-border-dark bg-background dark:bg-secondary-900 text-text dark:text-text-dark placeholder-text-secondary focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
        />
        <p className="text-sm text-text-secondary mt-2">
          Dodatkowe wytyczne dla asystenta AI dotyczące Twoich preferencji
        </p>
      </div>

      {/* Advanced Settings */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md">
        <h2 className="text-lg font-bold text-text dark:text-text-dark mb-4">
          Ustawienia zaawansowane
        </h2>

        <div className="space-y-6">
          {/* Temperature */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-medium text-text dark:text-text-dark">
                Kreatywność (temperatura)
              </label>
              <span className="text-sm font-mono text-violet-600 dark:text-violet-400">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  temperature: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-200 dark:bg-secondary-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>Precyzyjny</span>
              <span>Kreatywny</span>
            </div>
          </div>

          {/* Include Emoji */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-text dark:text-text-dark">
                Używaj emoji
              </label>
              <p className="text-sm text-text-secondary">
                Dodawaj emoji w odpowiedziach dla lepszej czytelności
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  includeEmoji: !settings.includeEmoji,
                })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.includeEmoji
                  ? "bg-violet-500"
                  : "bg-gray-300 dark:bg-secondary-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.includeEmoji ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border dark:border-border-dark text-text dark:text-text-dark hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Przywróć domyślne
        </button>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="h-4 w-4" />
          )}
          Zapisz ustawienia
        </button>
      </div>
    </div>
  );
}
