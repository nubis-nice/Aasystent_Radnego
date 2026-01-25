"use client";

import { LoginForm } from "@/components/auth/login-form";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { FileCheck, Sparkles } from "lucide-react";
import { Suspense, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

function LoginContent() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nasłuchuj na zmiany sesji - automatyczne przekierowanie po zalogowaniu
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[LOGIN] Auth state changed:", event, session?.user?.id);

      if (event === "SIGNED_IN" && session) {
        console.log("[LOGIN] User signed in, redirecting to dashboard...");
        window.location.href = "/dashboard";
      }
    });

    // Sprawdź czy już jest sesja
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log("[LOGIN] Existing session found, redirecting...");
        window.location.href = "/dashboard";
      }
    });

    // Obsługa błędów z URL
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      const decodedError = decodeURIComponent(errorParam);

      // Przyjazne komunikaty dla typowych błędów
      /* eslint-disable react-hooks/set-state-in-effect */
      if (decodedError === "session_expired") {
        setError("Sesja logowania wygasła. Spróbuj zalogować się ponownie.");
      } else if (decodedError.includes("invalid flow state")) {
        setError(
          "Link logowania wygasł lub jest nieprawidłowy. Zaloguj się ponownie.",
        );
      } else if (decodedError.includes("access_denied")) {
        setError("Anulowano logowanie.");
      } else {
        setError(decodedError);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-border p-8 space-y-6 backdrop-blur-sm">
          {/* Logo i nagłówek */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <FileCheck className="h-9 w-9 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                Asystent Radnego
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-medium">
                Panel do pracy z dokumentami Rady Miejskiej
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* OAuth Google */}
          <div>
            <GoogleLoginButton />
          </div>

          {/* Separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-text-secondary font-medium">
                lub
              </span>
            </div>
          </div>

          {/* Email/Hasło */}
          <LoginForm />

          {/* Info dla nowych użytkowników */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-text-secondary text-center font-medium">
              Nie masz konta? Skontaktuj się z administratorem.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-secondary-600 font-medium">
          &copy; 2025 Asystent Radnego. Wszelkie prawa zastrzeżone.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div>Ładowanie...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
