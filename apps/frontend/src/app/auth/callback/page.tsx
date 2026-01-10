"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("Przetwarzanie logowania...");

  useEffect(() => {
    const handleCallback = async () => {
      console.log("\n\n========== AUTH CALLBACK PAGE LOADED ==========");
      console.log("[AUTH CALLBACK] Full URL:", window.location.href);
      console.log("[AUTH CALLBACK] Search params:", window.location.search);
      console.log("[AUTH CALLBACK] Hash:", window.location.hash);

      // Sprawdź localStorage dla PKCE code_verifier
      const storedKeys = Object.keys(localStorage).filter(
        (k) =>
          k.includes("supabase") || k.includes("pkce") || k.includes("code")
      );
      console.log("[AUTH CALLBACK] Supabase localStorage keys:", storedKeys);

      try {
        // Sprawdź hash fragment (Implicit Flow - tokeny w #)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          setStatus("Ustawianie sesji...");
          console.log("Implicit Flow: Ustawianie sesji z tokenów w hash");

          // Ustaw sesję w Supabase z tokenów
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Błąd ustawiania sesji:", error);
            router.push(`/login?error=${encodeURIComponent(error.message)}`);
            return;
          }

          if (data.session) {
            console.log(
              "Sesja utworzona dla użytkownika:",
              data.session.user.id
            );
            setStatus("Przekierowanie do dashboard...");
            // Użyj window.location.href dla pełnego reload (wymusza odświeżenie cookies)
            window.location.href = "/dashboard";
            return;
          }
        }

        // Sprawdź query params (PKCE Flow - kod w ?)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const error = urlParams.get("error");
        const errorDescription = urlParams.get("error_description");

        if (error) {
          console.error("OAuth error:", error, errorDescription);

          // Obsługa specyficznych błędów OAuth
          if (error === "access_denied") {
            setStatus("Anulowano logowanie");
            setTimeout(() => router.push("/login"), 2000);
            return;
          }

          if (errorDescription?.includes("invalid flow state")) {
            setStatus("Sesja logowania wygasła. Spróbuj ponownie.");
            setTimeout(() => router.push("/login"), 2000);
            return;
          }

          window.location.href = `/login?error=${encodeURIComponent(
            errorDescription || error
          )}`;
          return;
        }

        if (code) {
          setStatus("Wymiana kodu na sesję...");
          console.log(
            "[AUTH CALLBACK] PKCE Flow: Wymiana kodu autoryzacyjnego"
          );
          console.log(
            "[AUTH CALLBACK] Code (first 20 chars):",
            code.substring(0, 20) + "..."
          );

          try {
            // Użyj exchangeCodeForSession zamiast przekierowania
            console.log("[AUTH CALLBACK] Calling exchangeCodeForSession...");
            const { data, error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code);
            console.log("[AUTH CALLBACK] exchangeCodeForSession result:", {
              hasData: !!data,
              hasSession: !!data?.session,
              hasError: !!exchangeError,
              errorMessage: exchangeError?.message,
            });

            if (exchangeError) {
              console.error(
                "[AUTH CALLBACK] Błąd wymiany kodu:",
                exchangeError
              );

              if (exchangeError.message.includes("invalid flow state")) {
                setStatus("Sesja logowania wygasła. Przekierowanie...");
                setTimeout(
                  () => router.push("/login?error=session_expired"),
                  2000
                );
                return;
              }

              router.push(
                `/login?error=${encodeURIComponent(exchangeError.message)}`
              );
              return;
            }

            if (data.session) {
              console.log(
                "Sesja utworzona dla użytkownika:",
                data.session.user.id
              );
              setStatus("Przekierowanie do dashboard...");
              window.location.href = "/dashboard";
              return;
            }
          } catch (err) {
            console.error("Błąd podczas wymiany kodu:", err);
            router.push(
              `/login?error=${encodeURIComponent(
                err instanceof Error ? err.message : "Unknown error"
              )}`
            );
            return;
          }
        }

        // Brak danych OAuth - prawdopodobnie bezpośrednie wejście na stronę
        console.log("Brak danych OAuth - przekierowanie do logowania");
        router.push("/login");
      } catch (err) {
        console.error("Błąd callback:", err);
        router.push(
          `/login?error=${encodeURIComponent(
            err instanceof Error ? err.message : "Unknown error"
          )}`
        );
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-text">{status}</p>
      </div>
    </div>
  );
}
