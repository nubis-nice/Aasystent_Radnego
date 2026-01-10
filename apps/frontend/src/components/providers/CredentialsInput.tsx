"use client";

import { useState } from "react";
import { Eye, EyeOff, Key, AlertCircle } from "lucide-react";

interface CredentialsInputProps {
  value: string;
  onChange: (value: string) => void;
  provider: string;
  disabled?: boolean;
  error?: string;
}

export function CredentialsInput({
  value,
  onChange,
  provider,
  disabled = false,
  error,
}: CredentialsInputProps) {
  const [showKey, setShowKey] = useState(false);

  const getPlaceholder = () => {
    switch (provider) {
      case "openai":
        return "sk-...";
      case "google":
        return "AIza...";
      case "anthropic":
        return "sk-ant-...";
      case "azure":
        return "Azure API Key";
      case "local":
        return "Opcjonalny (jeśli wymagany)";
      default:
        return "Wprowadź klucz API";
    }
  };

  const getHelpText = () => {
    switch (provider) {
      case "openai":
        return "Znajdź w: platform.openai.com/api-keys";
      case "google":
        return "Znajdź w: aistudio.google.com/app/apikey";
      case "anthropic":
        return "Znajdź w: console.anthropic.com/settings/keys";
      case "azure":
        return "Znajdź w Azure Portal → Cognitive Services";
      case "local":
        return "Pozostaw puste jeśli nie wymagane";
      default:
        return "Sprawdź dokumentację providera";
    }
  };

  const validateKey = (key: string): string | null => {
    if (!key && provider !== "local") {
      return "Klucz API jest wymagany";
    }

    if (key.length < 10 && provider !== "local") {
      return "Klucz API jest za krótki";
    }

    // Provider-specific validation
    switch (provider) {
      case "openai":
        if (key && !key.startsWith("sk-")) {
          return "Klucz OpenAI powinien zaczynać się od 'sk-'";
        }
        break;
      case "google":
        if (key && !key.startsWith("AIza")) {
          return "Klucz Google powinien zaczynać się od 'AIza'";
        }
        break;
      case "anthropic":
        if (key && !key.startsWith("sk-ant-")) {
          return "Klucz Anthropic powinien zaczynać się od 'sk-ant-'";
        }
        break;
    }

    return null;
  };

  const validationError = validateKey(value);

  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">
        Klucz API
      </label>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Key className="h-5 w-5 text-text-secondary" />
        </div>

        <input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={getPlaceholder()}
          className={`w-full pl-10 pr-12 py-3 border rounded-xl transition-all ${
            error || validationError
              ? "border-red-500 focus:ring-red-100"
              : "border-secondary-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          } ${disabled ? "bg-secondary-50 cursor-not-allowed" : "bg-white"}`}
        />

        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {showKey ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Help Text */}
      {!error && !validationError && (
        <p className="mt-2 text-xs text-text-secondary">{getHelpText()}</p>
      )}

      {/* Validation Error */}
      {validationError && !error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-orange-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* External Error */}
      {error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Security Notice */}
      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Key className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-green-800">
            Twój klucz API jest szyfrowany algorytmem AES-256-GCM przed
            zapisaniem w bazie danych.
          </p>
        </div>
      </div>
    </div>
  );
}
