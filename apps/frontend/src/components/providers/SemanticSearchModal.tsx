"use client";

import { useEffect, useState } from "react";
import { X, Save, RefreshCw } from "lucide-react";
export interface SemanticConfigFormData {
  provider: "exa" | "perplexity" | "tavily" | "brave";
  name: string;
  apiKey: string;
  baseUrl: string;
  searchEndpoint: string;
  resultsLimit: number;
  providerMeta?: Record<string, unknown>;
}

interface SemanticSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: SemanticConfigFormData) => Promise<void>;
  editingConfig?: {
    id: string;
    provider: SemanticConfigFormData["provider"];
    name: string;
    base_url: string | null;
    search_endpoint: string | null;
    results_limit: number | null;
  } | null;
}

const providerOptions: {
  value: SemanticConfigFormData["provider"];
  label: string;
  note?: string;
}[] = [
  { value: "exa", label: "Exa (semantic search)", note: "szybkie, płatne" },
  { value: "brave", label: "Brave Search", note: "2000 req/mies. za darmo" },
  { value: "perplexity", label: "Perplexity", note: "ma darmowy tier" },
  { value: "tavily", label: "Tavily", note: "darmowy plan / tani" },
];

export function SemanticSearchModal({
  isOpen,
  onClose,
  onSave,
  editingConfig,
}: SemanticSearchModalProps) {
  const [formData, setFormData] = useState<SemanticConfigFormData>({
    provider: "exa",
    name: "",
    apiKey: "",
    baseUrl: "",
    searchEndpoint: "/search",
    resultsLimit: 5,
    providerMeta: {},
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        provider: editingConfig.provider,
        name: editingConfig.name,
        apiKey: "",
        baseUrl: editingConfig.base_url || "",
        searchEndpoint: editingConfig.search_endpoint || "/search",
        resultsLimit: editingConfig.results_limit || 5,
        providerMeta: {},
      });
    } else {
      setFormData({
        provider: "exa",
        name: "",
        apiKey: "",
        baseUrl: "",
        searchEndpoint: "/search",
        resultsLimit: 5,
        providerMeta: {},
      });
    }
    setError(null);
  }, [editingConfig, isOpen]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("Nazwa konfiguracji jest wymagana");
      return;
    }
    if (!formData.apiKey && !editingConfig) {
      setError("Klucz API jest wymagany");
      return;
    }

    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Błąd podczas zapisywania";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-secondary-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-text-primary">
            {editingConfig
              ? "Edytuj wyszukiwarkę semantyczną"
              : "Nowa wyszukiwarka semantyczna"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Provider
              </label>
              <select
                value={formData.provider}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    provider: e.target
                      .value as SemanticConfigFormData["provider"],
                  })
                }
                disabled={saving || !!editingConfig}
                className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
              >
                {providerOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} {p.note ? `(${p.note})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Nazwa konfiguracji
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={saving}
                placeholder="np. Exa - szybkie wyszukiwanie"
                className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Klucz API
              </label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                disabled={saving}
                placeholder="sk-..."
                className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Base URL (opcjonalnie)
              </label>
              <input
                type="text"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
                disabled={saving}
                placeholder="https://api.exa.ai"
                className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Endpoint wyszukiwania
              </label>
              <input
                type="text"
                value={formData.searchEndpoint}
                onChange={(e) =>
                  setFormData({ ...formData, searchEndpoint: e.target.value })
                }
                disabled={saving}
                placeholder="/search"
                className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Limit wyników
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={formData.resultsLimit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    resultsLimit: Number(e.target.value),
                  })
                }
                disabled={saving}
                className="w-full px-4 py-3 border border-secondary-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all disabled:bg-secondary-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="p-3 bg-secondary-50 rounded-xl text-sm text-text-secondary flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Te ustawienia zapiszą się w tej samej tabeli, z typem konfiguracji{" "}
            <strong>semantic</strong>.
          </div>
        </div>

        <div className="border-t border-secondary-200 px-6 py-4 flex justify-end gap-3 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-secondary-300 text-text-primary hover:bg-secondary-100 transition-colors"
            disabled={saving}
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
