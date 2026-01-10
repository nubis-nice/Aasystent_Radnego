"use client";

import { useState, useEffect } from "react";
import {
  Globe,
  MapPin,
  Building2,
  Calendar,
  Link2,
  Save,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface LocaleSettings {
  language: string;
  timezone: string;
  date_format: string;
  time_format: string;
  municipality: string | null;
  voivodeship: string | null;
  bip_url: string | null;
  council_name: string | null;
}

const VOIVODESHIPS = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
];

const DATE_FORMATS = [
  { value: "DD.MM.YYYY", label: "31.12.2026" },
  { value: "YYYY-MM-DD", label: "2026-12-31" },
  { value: "DD/MM/YYYY", label: "31/12/2026" },
];

export default function LocalePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<LocaleSettings>({
    language: "pl",
    timezone: "Europe/Warsaw",
    date_format: "DD.MM.YYYY",
    time_format: "24h",
    municipality: null,
    voivodeship: null,
    bip_url: null,
    council_name: null,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_locale_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading locale settings:", error);
        return;
      }

      if (data) {
        setSettings({
          language: data.language || "pl",
          timezone: data.timezone || "Europe/Warsaw",
          date_format: data.date_format || "DD.MM.YYYY",
          time_format: data.time_format || "24h",
          municipality: data.municipality,
          voivodeship: data.voivodeship,
          bip_url: data.bip_url,
          council_name: data.council_name,
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("user_locale_settings").upsert(
        {
          user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      alert("Ustawienia zostały zapisane!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Błąd podczas zapisywania ustawień");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof LocaleSettings, value: string | null) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
            Język i region
          </h1>
          <p className="text-text-secondary mt-2 text-base font-medium">
            Ustaw preferowany język, format daty oraz dane lokalne
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 transition-all duration-200 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          <span>{saving ? "Zapisywanie..." : "Zapisz zmiany"}</span>
        </button>
      </div>

      {/* Język i format */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">Język i format</h2>
            <p className="text-sm text-text-secondary">
              Ustawienia wyświetlania dat i godzin
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Język interfejsu
            </label>
            <select
              value={settings.language}
              onChange={(e) => updateSetting("language", e.target.value)}
              className="w-full h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            >
              <option value="pl">Polski</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Format daty
            </label>
            <select
              value={settings.date_format}
              onChange={(e) => updateSetting("date_format", e.target.value)}
              className="w-full h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            >
              {DATE_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label} ({format.value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Format godziny
            </label>
            <select
              value={settings.time_format}
              onChange={(e) => updateSetting("time_format", e.target.value)}
              className="w-full h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            >
              <option value="24h">24-godzinny (14:30)</option>
              <option value="12h">12-godzinny (2:30 PM)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Strefa czasowa
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => updateSetting("timezone", e.target.value)}
              className="w-full h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            >
              <option value="Europe/Warsaw">Europa/Warszawa (CET/CEST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dane lokalne - Gmina/Rada */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">Dane lokalne</h2>
            <p className="text-sm text-text-secondary">
              Informacje o gminie i radzie miejskiej
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              <MapPin className="inline h-4 w-4 mr-2" />
              Gmina / Miasto
            </label>
            <input
              type="text"
              value={settings.municipality || ""}
              onChange={(e) =>
                updateSetting("municipality", e.target.value || null)
              }
              placeholder="np. Białobrzegi"
              className="w-full h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              <MapPin className="inline h-4 w-4 mr-2" />
              Województwo
            </label>
            <select
              value={settings.voivodeship || ""}
              onChange={(e) =>
                updateSetting("voivodeship", e.target.value || null)
              }
              className="w-full h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Wybierz województwo</option>
              {VOIVODESHIPS.map((v) => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-text mb-2">
              <Building2 className="inline h-4 w-4 mr-2" />
              Pełna nazwa Rady
            </label>
            <input
              type="text"
              value={settings.council_name || ""}
              onChange={(e) =>
                updateSetting("council_name", e.target.value || null)
              }
              placeholder="np. Rada Miejska w Białobrzegach"
              className="w-full h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-text mb-2">
              <Link2 className="inline h-4 w-4 mr-2" />
              Adres BIP
            </label>
            <input
              type="url"
              value={settings.bip_url || ""}
              onChange={(e) => updateSetting("bip_url", e.target.value || null)}
              placeholder="https://bip.bialobrzegi.pl"
              className="w-full h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            />
            <p className="text-xs text-text-secondary mt-1">
              Adres Biuletynu Informacji Publicznej Twojej gminy/miasta
            </p>
          </div>
        </div>
      </div>

      {/* Informacja o wykorzystaniu */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-text mb-1">
              Jak wykorzystujemy te dane?
            </h3>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>
                • <strong>Wyszukiwanie dokumentów</strong> - priorytetyzacja
                źródeł z Twojej gminy
              </li>
              <li>
                • <strong>Analiza AI</strong> - kontekst lokalny w odpowiedziach
                asystenta
              </li>
              <li>
                • <strong>BIP</strong> - automatyczne pobieranie dokumentów z
                Biuletynu Informacji Publicznej
              </li>
              <li>
                • <strong>Personalizacja</strong> - dostosowanie interfejsu do
                Twoich potrzeb
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
