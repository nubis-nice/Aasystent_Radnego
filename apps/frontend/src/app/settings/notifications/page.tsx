"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/supabase/settings";
import { supabase } from "@/lib/supabase/client";

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    emailNewDocument: true,
    emailAnalysisComplete: true,
    emailWeeklyReport: false,
    pushNewDocument: true,
    pushAnalysisComplete: false,
    pushChatMention: true,
  });

  // Pobierz ustawienia przy montowaniu
  useEffect(() => {
    async function loadSettings() {
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

        const notificationSettings = await getNotificationSettings(user.id);
        if (notificationSettings) {
          setSettings({
            emailNewDocument: notificationSettings.email_new_document,
            emailAnalysisComplete: notificationSettings.email_analysis_complete,
            emailWeeklyReport: notificationSettings.email_weekly_report,
            pushNewDocument: notificationSettings.push_new_document,
            pushAnalysisComplete: notificationSettings.push_analysis_complete,
            pushChatMention: notificationSettings.push_chat_mention,
          });
        }
      } catch (error) {
        console.error("Error loading notification settings:", error);
        setMessage({ type: "error", text: "Błąd podczas ładowania ustawień" });
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const toggleSetting = async (key: keyof typeof settings) => {
    if (!userId) return;

    const newValue = !settings[key];
    setSettings({ ...settings, [key]: newValue });
    setSaving(true);
    setMessage(null);

    try {
      // Mapowanie kluczy na nazwy kolumn w bazie
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();

      const result = await updateNotificationSettings(userId, {
        [dbKey]: newValue,
      } as any);

      if (result) {
        setMessage({ type: "success", text: "Ustawienia zostały zapisane" });
        setTimeout(() => setMessage(null), 2000);
      } else {
        setSettings({ ...settings, [key]: !newValue });
        setMessage({ type: "error", text: "Nie udało się zapisać zmian" });
      }
    } catch (error) {
      console.error("Error saving notification settings:", error);
      setSettings({ ...settings, [key]: !newValue });
      setMessage({ type: "error", text: "Wystąpił błąd podczas zapisywania" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-text-secondary">Ładowanie ustawień...</p>
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
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <p className="font-medium">{message.text}</p>
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
          Powiadomienia
        </h1>
        <p className="text-text-secondary mt-2 text-base font-medium">
          Konfiguruj powiadomienia email i w aplikacji
        </p>
      </div>

      {/* Email notifications */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-8 shadow-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">Powiadomienia Email</h2>
            <p className="text-sm text-text-secondary">
              Otrzymuj powiadomienia na adres email
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-secondary-500" />
              <div>
                <p className="font-semibold text-text">Nowe dokumenty</p>
                <p className="text-sm text-text-secondary">
                  Powiadomienie o dodaniu nowego dokumentu
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting("emailNewDocument")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.emailNewDocument
                  ? "bg-primary-500"
                  : "bg-secondary-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.emailNewDocument ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-secondary-500" />
              <div>
                <p className="font-semibold text-text">Zakończona analiza</p>
                <p className="text-sm text-text-secondary">
                  Powiadomienie o zakończeniu analizy dokumentu
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting("emailAnalysisComplete")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.emailAnalysisComplete
                  ? "bg-primary-500"
                  : "bg-secondary-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.emailAnalysisComplete
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-secondary-500" />
              <div>
                <p className="font-semibold text-text">Raport tygodniowy</p>
                <p className="text-sm text-text-secondary">
                  Podsumowanie aktywności z ostatniego tygodnia
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting("emailWeeklyReport")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.emailWeeklyReport
                  ? "bg-primary-500"
                  : "bg-secondary-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.emailWeeklyReport ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Push notifications */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-8 shadow-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">
              Powiadomienia w aplikacji
            </h2>
            <p className="text-sm text-text-secondary">
              Powiadomienia wyświetlane w aplikacji
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-secondary-500" />
              <div>
                <p className="font-semibold text-text">Nowe dokumenty</p>
                <p className="text-sm text-text-secondary">
                  Powiadomienie o dodaniu nowego dokumentu
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting("pushNewDocument")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.pushNewDocument ? "bg-primary-500" : "bg-secondary-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.pushNewDocument ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-secondary-500" />
              <div>
                <p className="font-semibold text-text">Zakończona analiza</p>
                <p className="text-sm text-text-secondary">
                  Powiadomienie o zakończeniu analizy dokumentu
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting("pushAnalysisComplete")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.pushAnalysisComplete
                  ? "bg-primary-500"
                  : "bg-secondary-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.pushAnalysisComplete
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-secondary-500" />
              <div>
                <p className="font-semibold text-text">Wzmianki w czacie</p>
                <p className="text-sm text-text-secondary">
                  Powiadomienie gdy ktoś wspomni o Tobie
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting("pushChatMention")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.pushChatMention ? "bg-primary-500" : "bg-secondary-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.pushChatMention ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
