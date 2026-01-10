"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getAppearanceSettings,
  updateAppearanceSettings,
} from "@/lib/supabase/settings";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  actualTheme: "light" | "dark";
  setTheme: (theme: Theme) => Promise<void>;
  fontSize: "small" | "medium" | "large";
  setFontSize: (size: "small" | "medium" | "large") => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [fontSize, setFontSizeState] = useState<"small" | "medium" | "large">(
    "medium"
  );
  const [actualTheme, setActualTheme] = useState<"light" | "dark">("light");
  const [userId, setUserId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Pobierz ustawienia użytkownika
  useEffect(() => {
    async function loadSettings() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const settings = await getAppearanceSettings(user.id);
          if (settings) {
            setThemeState(settings.theme);
            setFontSizeState(settings.font_size);
          }
        }
      } catch (error) {
        console.error("Error loading theme settings:", error);
      } finally {
        setMounted(true);
      }
    }

    loadSettings();
  }, []);

  // Zastosuj motyw do dokumentu
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Określ aktualny motyw
    let resolvedTheme: "light" | "dark" = "light";

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      resolvedTheme = mediaQuery.matches ? "dark" : "light";

      // Nasłuchuj zmian preferencji systemowych
      const handler = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? "dark" : "light";
        setActualTheme(newTheme);
        if (newTheme === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };

      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      resolvedTheme = theme;
    }

    setActualTheme(resolvedTheme);

    // Zastosuj klasę dark do HTML
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, mounted]);

  // Zastosuj rozmiar czcionki
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Usuń poprzednie klasy rozmiaru
    root.classList.remove("text-sm", "text-base", "text-lg");

    // Dodaj nową klasę
    switch (fontSize) {
      case "small":
        root.classList.add("text-sm");
        break;
      case "large":
        root.classList.add("text-lg");
        break;
      default:
        root.classList.add("text-base");
    }
  }, [fontSize, mounted]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);

    if (userId) {
      try {
        await updateAppearanceSettings(userId, { theme: newTheme });
      } catch (error) {
        console.error("Error saving theme:", error);
      }
    }
  };

  const setFontSize = async (newSize: "small" | "medium" | "large") => {
    setFontSizeState(newSize);

    if (userId) {
      try {
        await updateAppearanceSettings(userId, { font_size: newSize });
      } catch (error) {
        console.error("Error saving font size:", error);
      }
    }
  };

  // Nie renderuj dzieci dopóki nie załadujemy ustawień
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{ theme, actualTheme, setTheme, fontSize, setFontSize }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
