"use client";

import { useState, useEffect } from "react";
import { getVoiceSettings, updateVoiceSettings } from "@/lib/api/voice";

export function VoiceSettings() {
  const [settings, setSettings] = useState({
    wakeWord: "Asystencie",
    continuousMode: false,
    autoTTS: true,
    ttsVoice: "pl-PL-MarekNeural",
    ttsSpeed: 1.0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const data = await getVoiceSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      console.error("Failed to load voice settings:", err);
      setError("Nie udało się załadować ustawień");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await updateVoiceSettings(settings);
      setSuccessMessage("Ustawienia zapisane");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save voice settings:", err);
      setError("Nie udało się zapisać ustawień");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">Ładowanie ustawień...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Ustawienia głosowe
        </h2>
        <p className="text-sm text-gray-500">
          Konfiguracja rozpoznawania mowy i komend głosowych
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {successMessage}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Słowo wzywające
          </label>
          <input
            type="text"
            value={settings.wakeWord}
            onChange={(e) =>
              setSettings({ ...settings, wakeWord: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Asystencie"
          />
          <p className="text-xs text-gray-500 mt-1">
            Słowo rozpoczynające komendę głosową
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Tryb ciągłego nasłuchiwania
            </label>
            <p className="text-xs text-gray-500">
              Automatyczne wykrywanie komend głosowych
            </p>
          </div>
          <button
            onClick={() =>
              setSettings({
                ...settings,
                continuousMode: !settings.continuousMode,
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.continuousMode ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.continuousMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Automatyczne odpowiedzi głosowe (TTS)
            </label>
            <p className="text-xs text-gray-500">
              Asystent odpowiada głosem na komendy
            </p>
          </div>
          <button
            onClick={() =>
              setSettings({ ...settings, autoTTS: !settings.autoTTS })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoTTS ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.autoTTS ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Głos TTS
          </label>
          <select
            value={settings.ttsVoice}
            onChange={(e) =>
              setSettings({ ...settings, ttsVoice: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="pl-PL-MarekNeural">Polski - Marek (męski)</option>
            <option value="pl-PL-ZofiaNeural">Polski - Zofia (żeński)</option>
            <option value="pl-PL-AgnieszkaNeural">
              Polski - Agnieszka (żeński)
            </option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prędkość mowy: {settings.ttsSpeed.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.ttsSpeed}
            onChange={(e) =>
              setSettings({ ...settings, ttsSpeed: parseFloat(e.target.value) })
            }
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Wolno (0.5x)</span>
            <span>Normalnie (1.0x)</span>
            <span>Szybko (2.0x)</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Zapisywanie..." : "Zapisz ustawienia"}
        </button>
      </div>
    </div>
  );
}
