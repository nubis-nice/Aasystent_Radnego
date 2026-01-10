"use client";

import Link from "next/link";
import {
  User,
  Bell,
  Palette,
  Globe,
  Shield,
  Key,
  Database,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getUserProfile } from "@/lib/supabase/settings";
import { isAdmin } from "@/lib/supabase/auth";

interface UserData {
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [userData, setUserData] = useState<UserData>({
    fullName: "Ładowanie...",
    email: "Ładowanie...",
    role: "Ładowanie...",
    createdAt: "Ładowanie...",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Pobierz profil użytkownika
          const profile = await getUserProfile(user.id);

          // Sprawdź rolę
          const admin = await isAdmin();

          // Formatuj datę rejestracji
          const createdDate = new Date(user.created_at);
          const formattedDate = createdDate.toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });

          setUserData({
            fullName: profile?.full_name || "Brak danych",
            email: user.email || "Brak danych",
            role: admin ? "Administrator" : profile?.position || "Radny",
            createdAt: formattedDate,
          });
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, []);
  const settingsSections = [
    {
      title: "Profil użytkownika",
      description:
        "Zarządzaj swoimi danymi osobowymi i informacjami kontaktowymi",
      icon: User,
      href: "/settings/profile",
      color: "from-primary-500 to-primary-600",
    },
    {
      title: "Konfiguracja API",
      description: "Zarządzaj kluczami API dla OpenAI i lokalnych modeli AI",
      icon: Key,
      href: "/settings/api",
      color: "from-purple-500 to-indigo-600",
    },
    {
      title: "Źródła Danych",
      description: "Zarządzaj źródłami danych i monitorowaniem instytucji",
      icon: Database,
      href: "/settings/data-sources",
      color: "from-teal-500 to-cyan-600",
    },
    {
      title: "Bezpieczeństwo",
      description: "Zmień hasło i zarządzaj ustawieniami bezpieczeństwa konta",
      icon: Shield,
      href: "/change-password",
      color: "from-red-500 to-rose-600",
    },
    {
      title: "Powiadomienia",
      description: "Konfiguruj powiadomienia email i w aplikacji",
      icon: Bell,
      href: "/settings/notifications",
      color: "from-yellow-500 to-orange-500",
    },
    {
      title: "Wygląd",
      description: "Personalizuj motyw i układ interfejsu aplikacji",
      icon: Palette,
      href: "/settings/appearance",
      color: "from-pink-500 to-rose-600",
    },
    {
      title: "Język i region",
      description: "Ustaw preferowany język i format daty",
      icon: Globe,
      href: "/settings/locale",
      color: "from-green-500 to-emerald-600",
    },
    {
      title: "Prywatność",
      description: "Zarządzaj ustawieniami prywatności i danymi osobowymi",
      icon: Shield,
      href: "/settings/privacy",
      color: "from-blue-500 to-cyan-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
          Ustawienia
        </h1>
        <p className="text-text-secondary mt-2 text-base font-medium">
          Zarządzaj swoim kontem i preferencjami aplikacji
        </p>
      </div>

      {/* Settings grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start gap-4">
              <div
                className={`h-12 w-12 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
              >
                <section.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-text mb-2 group-hover:text-primary-600 transition-colors">
                  {section.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {section.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Account info */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-8 shadow-md">
        <h2 className="text-xl font-bold text-text dark:text-text-dark mb-6">
          Informacje o koncie
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-2">
                Nazwa użytkownika
              </p>
              <p className="text-base font-semibold text-text dark:text-text-dark">
                {userData.fullName}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-2">
                Email
              </p>
              <p className="text-base font-semibold text-text dark:text-text-dark">
                {userData.email}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-2">
                Rola
              </p>
              <p className="text-base font-semibold text-text dark:text-text-dark">
                {userData.role}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-2">
                Data rejestracji
              </p>
              <p className="text-base font-semibold text-text dark:text-text-dark">
                {userData.createdAt}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
