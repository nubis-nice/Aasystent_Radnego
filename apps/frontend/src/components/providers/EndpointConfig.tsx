"use client";

import { useState, useEffect } from "react";
import { Globe, RefreshCw } from "lucide-react";

interface EndpointConfigProps {
  provider: string;
  baseUrl: string;
  chatEndpoint?: string;
  embeddingsEndpoint?: string;
  modelsEndpoint?: string;
  onBaseUrlChange: (value: string) => void;
  onChatEndpointChange: (value: string) => void;
  onEmbeddingsEndpointChange: (value: string) => void;
  onModelsEndpointChange: (value: string) => void;
  disabled?: boolean;
}

export function EndpointConfig({
  provider,
  baseUrl,
  chatEndpoint,
  embeddingsEndpoint,
  modelsEndpoint,
  onBaseUrlChange,
  onChatEndpointChange,
  onEmbeddingsEndpointChange,
  onModelsEndpointChange,
  disabled = false,
}: EndpointConfigProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [defaults, setDefaults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (provider) {
      fetchDefaults();
    }
  }, [provider]);

  const fetchDefaults = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(
        `${apiUrl}/api/providers/${provider}/defaults`,
      );

      if (!response.ok) {
        console.error("Failed to fetch defaults:", response.status);
        return;
      }

      const data = await response.json();
      setDefaults(data.defaults);
    } catch (error) {
      console.error("Failed to fetch provider defaults:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDefaults = () => {
    if (defaults) {
      if (defaults.base_url) onBaseUrlChange(defaults.base_url);
      if (defaults.chat_endpoint) onChatEndpointChange(defaults.chat_endpoint);
      if (defaults.embeddings_endpoint)
        onEmbeddingsEndpointChange(defaults.embeddings_endpoint);
      if (defaults.models_endpoint)
        onModelsEndpointChange(defaults.models_endpoint);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-primary">
          Konfiguracja Endpointów
        </label>
        {defaults && (
          <button
            type="button"
            onClick={loadDefaults}
            disabled={disabled || loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Użyj domyślnych
          </button>
        )}
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Base URL
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Globe className="h-4 w-4 text-text-secondary" />
          </div>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            disabled={disabled}
            placeholder={defaults?.base_url || "https://api.example.com"}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-secondary-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
          />
        </div>
        {defaults?.base_url && (
          <p className="mt-1 text-xs text-text-secondary">
            Domyślnie: {defaults.base_url}
          </p>
        )}
      </div>

      {/* Chat Endpoint */}
      {defaults?.capabilities?.supports_chat && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Chat Endpoint
          </label>
          <input
            type="text"
            value={chatEndpoint || ""}
            onChange={(e) => onChatEndpointChange(e.target.value)}
            disabled={disabled}
            placeholder={defaults?.chat_endpoint || "/chat/completions"}
            className="w-full px-3 py-2.5 text-sm border border-secondary-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
          />
          {defaults?.chat_endpoint && (
            <p className="mt-1 text-xs text-text-secondary">
              Domyślnie: {defaults.chat_endpoint}
            </p>
          )}
        </div>
      )}

      {/* Embeddings Endpoint */}
      {defaults?.capabilities?.supports_embeddings && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Embeddings Endpoint
          </label>
          <input
            type="text"
            value={embeddingsEndpoint || ""}
            onChange={(e) => onEmbeddingsEndpointChange(e.target.value)}
            disabled={disabled}
            placeholder={defaults?.embeddings_endpoint || "/embeddings"}
            className="w-full px-3 py-2.5 text-sm border border-secondary-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
          />
          {defaults?.embeddings_endpoint && (
            <p className="mt-1 text-xs text-text-secondary">
              Domyślnie: {defaults.embeddings_endpoint}
            </p>
          )}
        </div>
      )}

      {/* Models Endpoint */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Models Endpoint
        </label>
        <input
          type="text"
          value={modelsEndpoint || ""}
          onChange={(e) => onModelsEndpointChange(e.target.value)}
          disabled={disabled}
          placeholder={defaults?.models_endpoint || "/models"}
          className="w-full px-3 py-2.5 text-sm border border-secondary-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
        />
        {defaults?.models_endpoint && (
          <p className="mt-1 text-xs text-text-secondary">
            Domyślnie: {defaults.models_endpoint}
          </p>
        )}
      </div>

      {/* Info Box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          💡 Pozostaw puste aby użyć domyślnych endpointów dla tego providera.
          Możesz je dostosować jeśli używasz niestandardowej konfiguracji.
        </p>
      </div>
    </div>
  );
}
