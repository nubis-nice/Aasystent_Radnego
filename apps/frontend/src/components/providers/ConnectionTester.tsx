"use client";

import { useState } from "react";
import { Loader2, CheckCircle, XCircle, AlertCircle, Zap } from "lucide-react";

interface ConnectionTesterProps {
  configId?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  configType?: "ai" | "semantic";
  searchEndpoint?: string;
  resultsLimit?: number;
  authMethod?: string;
  disabled?: boolean;
  onTestComplete?: (success: boolean) => void;
}

interface TestResult {
  test_type: string;
  status: string;
  response_time_ms: number | null;
  error_message: string | null;
  tested_at: string;
}

export function ConnectionTester({
  configId,
  provider,
  apiKey,
  baseUrl,
  configType,
  searchEndpoint,
  resultsLimit,
  authMethod,
  disabled = false,
  onTestComplete,
}: ConnectionTesterProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    try {
      setTesting(true);
      setResult(null);

      const body: Record<string, string | number | undefined> = {};

      if (configId) {
        body.config_id = configId;
      } else {
        if (!provider || !apiKey || !baseUrl) {
          throw new Error("Brak wymaganych danych do testu");
        }
        body.provider = provider;
        body.api_key = apiKey;
        body.base_url = baseUrl;
        body.auth_method = authMethod || "bearer";
        body.config_type = configType || "ai";
        if (searchEndpoint) body.search_endpoint = searchEndpoint;
        if (resultsLimit) body.results_limit = resultsLimit;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/test/connection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data.result);

      if (onTestComplete) {
        onTestComplete(data.result.status === "success");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test failed";
      setResult({
        test_type: "connection",
        status: "failed",
        response_time_ms: null,
        error_message: message,
        tested_at: new Date().toISOString(),
      });

      if (onTestComplete) {
        onTestComplete(false);
      }
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = () => {
    if (!result) return null;

    switch (result.status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "timeout":
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    if (!result) return "gray";

    switch (result.status) {
      case "success":
        return "green";
      case "failed":
        return "red";
      case "timeout":
        return "orange";
      default:
        return "gray";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-primary">
          Test Połączenia
        </label>
        <button
          type="button"
          onClick={runTest}
          disabled={disabled || testing}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testowanie...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Testuj połączenie
            </>
          )}
        </button>
      </div>

      {/* Test Result */}
      {result && (
        <div
          className={`p-4 border-2 rounded-xl ${
            result.status === "success"
              ? "bg-green-50 border-green-200"
              : result.status === "failed"
              ? "bg-red-50 border-red-200"
              : "bg-orange-50 border-orange-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <div className="font-medium text-text-primary">
                {result.status === "success"
                  ? "✅ Połączenie udane"
                  : result.status === "failed"
                  ? "❌ Połączenie nieudane"
                  : "⚠️ Timeout"}
              </div>

              {result.response_time_ms !== null && (
                <div className="text-sm text-text-secondary mt-1">
                  Czas odpowiedzi: {result.response_time_ms}ms
                </div>
              )}

              {result.error_message && (
                <div className="text-sm text-red-700 mt-2 p-2 bg-red-100 rounded">
                  {result.error_message}
                </div>
              )}

              {result.status === "success" && (
                <div className="text-sm text-green-700 mt-2">
                  Provider odpowiada poprawnie. Możesz zapisać konfigurację.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      {!result && !testing && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-700">
            💡 Przetestuj połączenie przed zapisaniem konfiguracji aby upewnić
            się, że wszystkie dane są poprawne.
          </p>
        </div>
      )}
    </div>
  );
}
