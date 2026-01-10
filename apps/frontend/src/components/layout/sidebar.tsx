"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  User,
  LogOut,
  KeyRound,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { signOut, isAdmin } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { getUserProfile } from "@/lib/supabase/settings";

const navigation = [
  { name: "Pulpit", href: "/dashboard", icon: LayoutDashboard },
  { name: "Dokumenty", href: "/documents", icon: FileText },
  { name: "Czat AI", href: "/chat", icon: MessageSquare },
  { name: "Ustawienia", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState("Użytkownik");
  const [userPosition, setUserPosition] = useState("Radny");

  // Pobierz dane użytkownika
  useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          // Sprawdź rolę
          const admin = await isAdmin();
          setUserRole(admin ? "admin" : "radny");

          // Pobierz profil
          const profile = await getUserProfile(user.id);
          if (profile) {
            setUserName(profile.full_name);
            setUserPosition(profile.position || "Radny");
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    }

    loadUserData();

    // Nasłuchuj zmian w profilu (opcjonalnie)
    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
        },
        (payload) => {
          if (payload.new) {
            setUserName((payload.new as any).full_name);
            setUserPosition((payload.new as any).position || "Radny");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-64"
      } bg-white dark:bg-secondary-900 border-r border-border dark:border-border-dark h-screen flex flex-col transition-all duration-300 ease-in-out`}
    >
      {/* Logo/Brand Section */}
      {!isCollapsed && (
        <div className="px-6 py-5 border-b border-border dark:border-border-dark">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg dark:shadow-lg dark:shadow-secondary-800">
              <FileCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base text-text dark:text-text-dark">
                Asystent Radnego
              </h2>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                Panel zarządzania
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-6 px-4">
        <nav className="space-y-1.5">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 dark:shadow-lg dark:shadow-primary-500/30"
                    : "text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-800/20 hover:text-secondary-900"
                } ${isCollapsed ? "justify-center px-3" : ""}`}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon
                  className={`h-6 w-6 flex-shrink-0 ${
                    isActive
                      ? "text-white"
                      : "text-secondary-500 dark:text-secondary-400 group-hover:text-primary-500"
                  }`}
                />
                {!isCollapsed && (
                  <span className="tracking-tight text-text dark:text-text-dark">
                    {item.name}
                  </span>
                )}
                {!isCollapsed && isActive && (
                  <div className="ml-auto h-2 w-2 rounded-full bg-white dark:bg-secondary-800"></div>
                )}
              </Link>
            );
          })}

          {/* Panel Admina - tylko dla adminów */}
          {userRole === "admin" && (
            <Link
              href="/admin/users"
              className={`group flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 mt-4 border-t border-border pt-6 ${
                pathname.startsWith("/admin")
                  ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 dark:shadow-lg dark:shadow-purple-500/30"
                  : "text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-800/20 hover:text-secondary-900"
              } ${isCollapsed ? "justify-center px-3" : ""}`}
              title={isCollapsed ? "Panel Admina" : undefined}
            >
              <Shield
                className={`h-6 w-6 flex-shrink-0 ${
                  pathname.startsWith("/admin")
                    ? "text-white"
                    : "text-purple-500 dark:text-purple-400 group-hover:text-purple-600"
                }`}
              />
              {!isCollapsed && (
                <span className="tracking-tight text-text dark:text-text-dark">
                  Panel Admina
                </span>
              )}
            </Link>
          )}
        </nav>
      </div>

      {/* Herb Drawna i Menu Użytkownika */}
      <div className="border-t border-border dark:border-border-dark">
        {/* Herb Drawna */}
        {!isCollapsed && (
          <div className="px-6 py-4 flex items-center justify-center border-b border-border dark:border-border-dark">
            <img
              src="/herb.png"
              alt="Herb Gminy Drawno"
              className="w-16 h-16 object-contain"
            />
          </div>
        )}

        {/* Menu użytkownika */}
        <div className="p-4 relative">
          {!isCollapsed ? (
            <div>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-800/20 hover:text-secondary-900 transition-all duration-200"
              >
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg dark:shadow-lg dark:shadow-secondary-800">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-text dark:text-text-dark">
                    {userName}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                    {userPosition}
                  </p>
                </div>
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-secondary-800 rounded-xl shadow-xl border border-border dark:border-border-dark py-2 z-50">
                  <Link
                    href="/settings/profile"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary-700 dark:text-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-800/20 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User className="h-4 w-4" />
                    <span>Mój profil</span>
                  </Link>
                  <Link
                    href="/change-password"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary-700 dark:text-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-800/20 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>Zmień hasło</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-danger dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Wyloguj się</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsCollapsed(false)}
              className="flex w-full items-center justify-center rounded-xl p-3 text-secondary-600 hover:bg-secondary-50 transition-all duration-200"
            >
              <User className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Przycisk zwiń/rozwiń */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900 transition-all duration-200 font-medium"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <div className="flex items-center gap-3 w-full">
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm">Zwiń menu</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
