"use client";

import { useState } from "react";
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function AppearancePage() {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    theme,
    setTheme: setThemeContext,
    fontSize,
    setFontSize: setFontSizeContext,
  } = useTheme();

  const handleThemeChange = async (newTheme: "light" | "dark" | "system") => {
    try {
      await setThemeContext(newTheme);
      setMessage({ type: "success", text: "Motyw został zmieniony" });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error("Error saving theme:", error);
      setMessage({ type: "error", text: "Wystąpił błąd podczas zapisywania" });
    }
  };

  const handleFontSizeChange = async (
    newSize: "small" | "medium" | "large"
  ) => {
    try {
      await setFontSizeContext(newSize);
      setMessage({
        type: "success",
        text: "Rozmiar czcionki został zmieniony",
      });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error("Error saving font size:", error);
      setMessage({ type: "error", text: "Wystąpił błąd podczas zapisywania" });
    }
  };

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
          Wygląd
        </h1>
        <p className="text-text-secondary mt-2 text-base font-medium">
          Personalizuj motyw i układ interfejsu aplikacji
        </p>
      </div>

      {/* Theme selection */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-8 shadow-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <Palette className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">Motyw kolorystyczny</h2>
            <p className="text-sm text-text-secondary">
              Wybierz preferowany motyw aplikacji
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => handleThemeChange("light")}
            className={`p-6 rounded-2xl border-2 transition-all duration-200 ${
              theme === "light"
                ? "border-primary-500 bg-primary-50"
                : "border-border hover:border-secondary-300"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Sun className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text">Jasny</p>
                <p className="text-sm text-text-secondary">
                  Klasyczny jasny motyw
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange("dark")}
            className={`p-6 rounded-2xl border-2 transition-all duration-200 ${
              theme === "dark"
                ? "border-primary-500 bg-primary-50"
                : "border-border hover:border-secondary-300"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Moon className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text">Ciemny</p>
                <p className="text-sm text-text-secondary">
                  Oszczędza wzrok w nocy
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange("system")}
            className={`p-6 rounded-2xl border-2 transition-all duration-200 ${
              theme === "system"
                ? "border-primary-500 bg-primary-50"
                : "border-border hover:border-secondary-300"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Monitor className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text">Systemowy</p>
                <p className="text-sm text-text-secondary">
                  Dopasuj do systemu
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Font size */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-8 shadow-md">
        <h2 className="text-xl font-bold text-text mb-6">Rozmiar czcionki</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div>
              <p className="font-semibold text-text">Mała</p>
              <p className="text-sm text-text-secondary">Kompaktowy widok</p>
            </div>
            <input
              type="radio"
              name="fontSize"
              value="small"
              checked={fontSize === "small"}
              onChange={(e) =>
                handleFontSizeChange(
                  e.target.value as "small" | "medium" | "large"
                )
              }
              className="h-5 w-5 text-primary-500"
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div>
              <p className="font-semibold text-text">Średnia</p>
              <p className="text-sm text-text-secondary">
                Domyślny rozmiar (zalecany)
              </p>
            </div>
            <input
              type="radio"
              name="fontSize"
              value="medium"
              checked={fontSize === "medium"}
              onChange={(e) =>
                handleFontSizeChange(
                  e.target.value as "small" | "medium" | "large"
                )
              }
              className="h-5 w-5 text-primary-500"
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary-50 transition-colors">
            <div>
              <p className="font-semibold text-text">Duża</p>
              <p className="text-sm text-text-secondary">
                Łatwiejsza do czytania
              </p>
            </div>
            <input
              type="radio"
              name="fontSize"
              value="large"
              checked={fontSize === "large"}
              onChange={(e) =>
                handleFontSizeChange(
                  e.target.value as "small" | "medium" | "large"
                )
              }
              className="h-5 w-5 text-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
