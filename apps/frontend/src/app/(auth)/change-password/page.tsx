"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Hasła nie są identyczne.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      setIsLoading(false);
      return;
    }

    try {
      const { error: changeError } = await changePassword(password);

      if (changeError) {
        setError(changeError.message || "Błąd podczas zmiany hasła.");
        return;
      }

      // Przekieruj do dashboardu po sukcesie
      router.push("/dashboard");
    } catch (err) {
      console.error("Change password error:", err);
      setError("Wystąpił nieoczekiwany błąd. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg border border-border p-8 space-y-6">
          {/* Logo i nagłówek */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary mb-4">
              <Lock className="h-8 w-8" />
              <span className="text-2xl font-bold">Asystent Radnego</span>
            </div>
            <h1 className="text-2xl font-bold text-text">Ustaw nowe hasło</h1>
            <p className="text-secondary text-sm">
              Wprowadź nowe hasło dla swojego konta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1 text-text"
              >
                Nowe hasło
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

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium mb-1 text-text"
              >
                Potwierdź hasło
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Zmienianie hasła..." : "Zmień hasło"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-secondary-600 font-medium">
          &copy; 2025 Asystent Radnego. Wszelkie prawa zastrzeżone.
        </p>
      </div>
    </div>
  );
}
