"use client";

import { useState, useEffect } from "react";
import { ProviderType, ProviderCapability } from "@aasystent-radnego/shared";
import { ChevronDown, Check, Info } from "lucide-react";

interface ProviderSelectorProps {
  value: ProviderType | "exa" | "perplexity" | "tavily" | "";
  onChange: (provider: ProviderType | "exa" | "perplexity" | "tavily") => void;
  disabled?: boolean;
}

export function ProviderSelector({
  value,
  onChange,
  disabled = false,
}: ProviderSelectorProps) {
  const [capabilities, setCapabilities] = useState<ProviderCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchCapabilities();
  }, []);

  const fetchCapabilities = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(`${apiUrl}/api/providers/capabilities`);

      if (!response.ok) {
        console.error("Failed to fetch capabilities:", response.status);
        return;
      }

      const data = await response.json();
      setCapabilities(data.capabilities || []);
    } catch (error) {
      console.error("Failed to fetch provider capabilities:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = capabilities.find((p) => p.provider === value);

  const providerIcons: Record<string, string> = {
    openai: "🤖",
    google: "🔍",
    anthropic: "🧠",
    azure: "☁️",
    moonshot: "🌙",
    deepseek: "🔬",
    cohere: "🔗",
    mistral: "🌪️",
    groq: "⚡",
    perplexity: "🔮",
    together: "🤝",
    huggingface: "🤗",
    replicate: "🔄",
    local: "💻",
    // Deep Research providers
    exa: "🔎",
    tavily: "📚",
    serper: "🌐",
    firecrawl: "🕷️",
    other: "⚙️",
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-text-primary mb-2">
        Provider LLM
      </label>

      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`w-full flex items-center justify-between px-4 py-3 bg-white border rounded-xl transition-all ${
          disabled || loading
            ? "border-secondary-200 bg-secondary-50 cursor-not-allowed"
            : isOpen
            ? "border-primary-500 ring-2 ring-primary-100"
            : "border-secondary-300 hover:border-primary-400"
        }`}
      >
        <div className="flex items-center gap-3">
          {selectedProvider ? (
            <>
              <span className="text-2xl">
                {providerIcons[selectedProvider.provider] || "⚙️"}
              </span>
              <div className="text-left">
                <div className="font-medium text-text-primary">
                  {selectedProvider.provider.charAt(0).toUpperCase() +
                    selectedProvider.provider.slice(1)}
                </div>
                <div className="text-xs text-text-secondary">
                  {selectedProvider.supports_chat && "Chat"}
                  {selectedProvider.supports_chat &&
                    selectedProvider.supports_embeddings &&
                    " • "}
                  {selectedProvider.supports_embeddings && "Embeddings"}
                </div>
              </div>
            </>
          ) : (
            <span className="text-text-secondary">
              {loading ? "Ładowanie..." : "Wybierz providera"}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 text-text-secondary transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-secondary-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
          {capabilities.map((provider) => (
            <button
              key={provider.provider}
              type="button"
              onClick={() => {
                onChange(provider.provider as ProviderType);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary-50 transition-colors ${
                value === provider.provider ? "bg-primary-50" : ""
              }`}
            >
              <span className="text-2xl">
                {providerIcons[provider.provider] || "⚙️"}
              </span>
              <div className="flex-1 text-left">
                <div className="font-medium text-text-primary">
                  {provider.provider.charAt(0).toUpperCase() +
                    provider.provider.slice(1)}
                </div>
                <div className="text-xs text-text-secondary flex items-center gap-2 flex-wrap">
                  {provider.supports_chat && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
                      Chat
                    </span>
                  )}
                  {provider.supports_embeddings && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Embeddings
                    </span>
                  )}
                  {provider.supports_streaming && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                      Streaming
                    </span>
                  )}
                  {provider.supports_function_calling && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                      Functions
                    </span>
                  )}
                  {provider.supports_vision && (
                    <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded">
                      Vision
                    </span>
                  )}
                </div>
              </div>
              {value === provider.provider && (
                <Check className="h-5 w-5 text-primary-600" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Provider Info */}
      {selectedProvider && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800">
              {selectedProvider.documentation_url ? (
                <a
                  href={selectedProvider.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-900"
                >
                  Dokumentacja providera
                </a>
              ) : (
                "Wybrano providera"
              )}
              {selectedProvider.rate_limit_rpm && (
                <span className="ml-2">
                  • Limit: {selectedProvider.rate_limit_rpm} req/min
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
