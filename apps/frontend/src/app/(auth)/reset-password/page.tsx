"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: resetError } = await requestPasswordReset(email);

      if (resetError) {
        setError(resetError.message || "Błąd podczas wysyłania emaila.");
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);
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
              <FileText className="h-8 w-8" />
              <span className="text-2xl font-bold">Asystent Radnego</span>
            </div>
            <h1 className="text-2xl font-bold text-text">Resetuj hasło</h1>
            <p className="text-secondary text-sm">
              Podaj swój adres email, a wyślemy Ci link do zresetowania hasła.
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  Email z linkiem do resetowania hasła został wysłany na adres{" "}
                  <strong>{email}</strong>. Sprawdź swoją skrzynkę pocztową.
                </p>
              </div>
              <Link href="/login">
                <Button className="w-full">Wróć do logowania</Button>
              </Link>
            </div>
          ) : (
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Wysyłanie..." : "Wyślij link resetujący"}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-primary hover:text-primary-hover transition-colors"
                >
                  Wróć do logowania
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-secondary-600 font-medium">
          &copy; 2025 Asystent Radnego. Wszelkie prawa zastrzeżone.
        </p>
      </div>
    </div>
  );
}
