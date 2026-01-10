"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword } from "@/lib/supabase/auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const {
        user,
        requiresPasswordChange,
        error: authError,
      } = await signInWithPassword(email, password);

      if (authError) {
        setError(authError.message || "Błąd logowania. Sprawdź email i hasło.");
        return;
      }

      if (user) {
        if (requiresPasswordChange) {
          // Przekieruj do strony zmiany hasła
          router.push("/change-password");
        } else {
          // Przekieruj do dashboardu
          router.push("/dashboard");
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Wystąpił nieoczekiwany błąd. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1 text-text"
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twój@email.com"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1 text-text"
          >
            Hasło
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-end">
          <a
            href="/reset-password"
            className="text-sm text-primary hover:text-primary-hover transition-colors"
          >
            Zapomniałeś hasła?
          </a>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logowanie..." : "Zaloguj się"}
        </Button>
      </form>
    </div>
  );
}
