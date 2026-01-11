"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Plus,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  FileText,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
  Pencil,
  X,
  Search,
} from "lucide-react";
import {
  getDataSources,
  getDataSourcesStats,
  getSourceDocuments,
  updateDataSource,
  deleteDataSource,
  triggerScraping,
  createDataSource,
  seedTestData,
  type DataSource,
  type DataSourcesStats,
  type ProcessedDocument,
} from "@/lib/api/data-sources";
import { useToast } from "@/lib/notifications/toast";

export default function DataSourcesPage() {
  const [activeTab, setActiveTab] = useState<"sources" | "documents" | "stats">(
    "sources"
  );
  const [sources, setSources] = useState<DataSource[]>([]);
  const [stats, setStats] = useState<DataSourcesStats | null>(null);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourcesData, statsData, docsResponse] = await Promise.all([
        getDataSources(),
        getDataSourcesStats(),
        getSourceDocuments(),
      ]);
      setSources(sourcesData);
      setStats(statsData);
      setDocuments(docsResponse.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd ładowania danych");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-danger mb-4" />
        <p className="text-danger font-medium">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Źródła Danych</h1>
        <p className="text-text-secondary mt-1">
          Zarządzaj źródłami danych dla Asystenta AI - strony gminy, BIP,
          portale prawne
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("sources")}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === "sources"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Database className="inline h-4 w-4 mr-2" />
            Źródła ({sources.length})
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === "documents"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <FileText className="inline h-4 w-4 mr-2" />
            Dokumenty ({stats?.documents.total || 0})
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === "stats"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <BarChart3 className="inline h-4 w-4 mr-2" />
            Statystyki
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "sources" && (
        <SourcesTab
          sources={sources}
          onRefresh={loadData}
          onToggle={async (id, isActive) => {
            await updateDataSource(id, { is_active: !isActive });
            loadData();
          }}
          onDelete={async (id) => {
            if (confirm("Czy na pewno chcesz usunąć to źródło?")) {
              await deleteDataSource(id);
              loadData();
            }
          }}
          onScrape={async (id) => {
            const source = sources.find((s) => s.id === id);
            const sourceName = source?.name || "Źródło";

            try {
              // Informacja o rozpoczęciu scrapingu
              toast.info(
                "Rozpoczęto scraping",
                `Pobieranie danych ze źródła: ${sourceName}. To może potrwać 30-60 sekund...`
              );

              // Wywołaj scraping
              const result = await triggerScraping(id);

              // Sukces - pokaż szczegóły
              if (result.status === "success" || result.status === "ok") {
                toast.success(
                  "Scraping zakończony pomyślnie",
                  `Źródło: ${sourceName}. ${
                    result.message || "Dane zostały pobrane i przetworzone."
                  }`
                );
              } else {
                toast.warning(
                  "Scraping zakończony z ostrzeżeniami",
                  `Źródło: ${sourceName}. ${
                    result.message || "Sprawdź logi dla szczegółów."
                  }`
                );
              }

              // Odśwież dane po 2 sekundach aby pokazać nowy status
              setTimeout(() => {
                loadData();
              }, 2000);
            } catch (error) {
              // Błąd - pokaż szczegóły
              const errorMessage =
                error instanceof Error ? error.message : "Nieznany błąd";

              toast.error(
                "Błąd scrapingu",
                `Źródło: ${sourceName}. ${errorMessage}. Sprawdź czy migracja 013 została uruchomiona w Supabase.`
              );

              console.error("Scraping error:", error);
            }
          }}
          onAdd={async (data) => {
            await createDataSource(data);
            loadData();
          }}
        />
      )}
      {activeTab === "documents" && (
        <DocumentsTab documents={documents} setDocuments={setDocuments} />
      )}
      {activeTab === "stats" && <StatsTab stats={stats} />}
    </div>
  );
}

function SourcesTab({
  sources,
  onRefresh,
  onToggle,
  onDelete,
  onScrape,
  onAdd,
}: {
  sources: DataSource[];
  onRefresh: () => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onScrape: (id: string) => Promise<void>;
  onAdd: (data: {
    name: string;
    base_url: string;
    source_type: string;
  }) => Promise<void>;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSource, setNewSource] = useState({
    name: "",
    base_url: "",
    source_type: "scraper_bip",
    fetch_method: "scraping" as "api" | "scraping" | "hybrid",
  });
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newSource.name || !newSource.base_url) return;
    setAdding(true);
    try {
      await onAdd(newSource);
      setShowAddModal(false);
      setNewSource({
        name: "",
        base_url: "",
        source_type: "bip",
        fetch_method: "hybrid",
      });
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Nigdy";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Przed chwilą";
    if (hours < 24) return `${hours}h temu`;
    const days = Math.floor(hours / 24);
    return `${days}d temu`;
  };

  return (
    <div className="space-y-4">
      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-primary border border-border rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Dodaj źródło danych</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nazwa</label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) =>
                    setNewSource({ ...newSource, name: e.target.value })
                  }
                  placeholder="np. BIP Gminy Drawno"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="url"
                  value={newSource.base_url}
                  onChange={(e) =>
                    setNewSource({ ...newSource, base_url: e.target.value })
                  }
                  placeholder="https://bip.drawno.pl"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Typ źródła
                </label>
                <select
                  value={newSource.source_type}
                  onChange={(e) =>
                    setNewSource({ ...newSource, source_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <optgroup label="Źródła prawne (API/Scraping)">
                    <option value="api_isap">ISAP - Akty prawne</option>
                    <option value="api_wsa_nsa">WSA/NSA - Orzecznictwo</option>
                    <option value="api_rio">RIO - Nadzór finansowy</option>
                    <option value="scraper_dziennik">Dziennik Urzędowy</option>
                  </optgroup>
                  <optgroup label="Źródła samorządowe (Scraping)">
                    <option value="scraper_bip">
                      BIP - Biuletyn Informacji Publicznej
                    </option>
                    <option value="municipality">Strona gminy</option>
                    <option value="councilor">Portal radnego</option>
                  </optgroup>
                  <optgroup label="Multimedia">
                    <option value="youtube">
                      YouTube - Transkrypcje wideo
                    </option>
                  </optgroup>
                  <optgroup label="Inne">
                    <option value="statistics">Statystyki (GUS)</option>
                    <option value="scraper_custom">
                      Niestandardowe źródło
                    </option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Metoda pobierania
                </label>
                <select
                  value={newSource.fetch_method}
                  onChange={(e) =>
                    setNewSource({
                      ...newSource,
                      fetch_method: e.target.value as
                        | "api"
                        | "scraping"
                        | "hybrid",
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="scraping">Scraping (Web)</option>
                  <option value="api">API (REST/JSON)</option>
                  <option value="hybrid">Hybrydowa (API + Scraping)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-background-secondary"
              >
                Anuluj
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !newSource.name || !newSource.base_url}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
              >
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Dodaj źródło
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 border border-border rounded-lg hover:bg-background-secondary transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Odśwież wszystkie
          </button>
        </div>
      </div>

      {/* Sources List */}
      <div className="grid gap-4">
        {sources.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Brak skonfigurowanych źródeł danych</p>
            <p className="text-sm mt-1">Dodaj pierwsze źródło aby rozpocząć</p>
          </div>
        ) : (
          sources.map((source) => (
            <SourceCard
              key={source.id}
              id={source.id}
              name={source.name}
              type={source.source_type}
              url={source.base_url}
              enabled={source.is_active}
              frequency={
                source.schedule_cron === "0 6 * * *" ? "daily" : "weekly"
              }
              lastScraped={formatDate(source.last_scraped_at)}
              nextScrape={source.is_active ? "Wg harmonogramu" : "-"}
              documentsCount={source.documents_count || 0}
              status={
                source.last_scrape?.status === "error"
                  ? "error"
                  : source.is_active
                  ? "success"
                  : "skipped"
              }
              onToggle={() => onToggle(source.id, source.is_active)}
              onDelete={() => onDelete(source.id)}
              onScrape={() => onScrape(source.id)}
              onEdit={async (data) => {
                await updateDataSource(source.id, data);
                onRefresh();
              }}
            />
          ))
        )}
      </div>

      {/* Predefined Sources */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">
          Dostępne źródła do dodania
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <PredefinedSourceCard
            name="Portal Samorządowy"
            description="Informacje, szkolenia i narzędzia dla samorządowców"
            category="Dla radnych"
            url="https://www.portalsamorzadowy.pl"
            sourceType="councilor"
            onAdd={onAdd}
          />
          <PredefinedSourceCard
            name="GUS - Bank Danych Lokalnych"
            description="Dane demograficzne, ekonomiczne, społeczne"
            category="Statystyki"
            url="https://bdl.stat.gov.pl"
            sourceType="statistics"
            onAdd={onAdd}
          />
          <PredefinedSourceCard
            name="Monitor Polski"
            description="Dziennik urzędowy RP - akty wykonawcze"
            category="Prawo"
            url="https://monitorpolski.gov.pl"
            sourceType="legal"
            onAdd={onAdd}
          />
          <PredefinedSourceCard
            name="Związek Gmin Wiejskich RP"
            description="Aktualności i stanowiska ZGW RP"
            category="Dla radnych"
            url="https://zgwrp.pl"
            sourceType="councilor"
            onAdd={onAdd}
          />
          <PredefinedSourceCard
            name="YouTube - Sesje Rady"
            description="Transkrypcje z nagrań sesji rady miejskiej i innych materiałów wideo"
            category="Multimedia"
            url="https://www.youtube.com"
            sourceType="youtube"
            onAdd={onAdd}
          />
        </div>
      </div>
    </div>
  );
}

function SourceCard({
  id,
  name,
  type,
  url,
  enabled,
  frequency,
  lastScraped,
  nextScrape,
  documentsCount,
  status,
  onToggle,
  onDelete,
  onScrape,
  onEdit,
}: {
  id: string;
  name: string;
  type: string;
  url: string;
  enabled: boolean;
  frequency: string;
  lastScraped: string;
  nextScrape: string;
  documentsCount: number;
  status: "success" | "error" | "skipped";
  onToggle?: () => void;
  onDelete?: () => void;
  onScrape?: () => Promise<void>;
  onEdit?: (data: {
    name: string;
    base_url: string;
    source_type: string;
    schedule_cron: string;
  }) => Promise<void>;
}) {
  const [scraping, setScraping] = useState(false);
  const [searching, setSearching] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    documents: Array<{
      id: string;
      title: string;
      excerpt: string;
      relevanceScore: number;
      url: string;
    }>;
    totalFound: number;
  } | null>(null);
  const [editData, setEditData] = useState({
    name: name,
    base_url: url,
    source_type: type,
    schedule_cron: frequency === "daily" ? "0 6 * * *" : "0 6 * * 0",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onEdit) return;
    setSaving(true);
    try {
      await onEdit(editData);
      setShowEditModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleScrape = async () => {
    if (!onScrape) return;
    setScraping(true);
    setScrapeResult(null);
    try {
      await onScrape();
      setScrapeResult({ success: true, message: "Scraping zakończony!" });
    } catch (e) {
      setScrapeResult({
        success: false,
        message: e instanceof Error ? e.message : "Błąd scrapingu",
      });
    } finally {
      setScraping(false);
      setTimeout(() => setScrapeResult(null), 5000);
    }
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const token = localStorage.getItem("supabase_access_token");
      const response = await fetch(`/api/data-sources/${id}/semantic-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: searchQuery,
          maxResults: 15,
          minRelevance: 0.3,
          deepCrawl: false,
          enableIntelligentScraping: true, // Włącz inteligentny scraping gdy brak wyników
          minResultsBeforeScraping: 3,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSearchResults({
          documents: data.documents || [],
          totalFound: data.totalFound || 0,
        });
      }
    } catch (e) {
      console.error("Semantic search error:", e);
    } finally {
      setSearching(false);
    }
  };

  const typeColors = {
    municipality: "bg-blue-100 text-blue-700",
    bip: "bg-purple-100 text-purple-700",
    legal: "bg-green-100 text-green-700",
    councilor: "bg-orange-100 text-orange-700",
    statistics: "bg-pink-100 text-pink-700",
    youtube: "bg-red-100 text-red-700",
  };

  const statusIcons = {
    success: <CheckCircle className="h-4 w-4 text-success" />,
    error: <XCircle className="h-4 w-4 text-danger" />,
    skipped: <Clock className="h-4 w-4 text-text-secondary" />,
  };

  return (
    <>
      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-primary border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edytuj źródło danych</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-background-secondary rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nazwa</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) =>
                    setEditData({ ...editData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="url"
                  value={editData.base_url}
                  onChange={(e) =>
                    setEditData({ ...editData, base_url: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Typ źródła
                </label>
                <select
                  value={editData.source_type}
                  onChange={(e) =>
                    setEditData({ ...editData, source_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="bip">BIP</option>
                  <option value="municipality">Gmina</option>
                  <option value="legal">Prawne</option>
                  <option value="councilor">Radny</option>
                  <option value="statistics">Statystyki</option>
                  <option value="youtube">YouTube</option>
                  <option value="custom">Inne</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Częstotliwość
                </label>
                <select
                  value={editData.schedule_cron}
                  onChange={(e) =>
                    setEditData({ ...editData, schedule_cron: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="0 6 * * *">Codziennie</option>
                  <option value="0 6 * * 0">Co tydzień</option>
                  <option value="0 6 1 * *">Co miesiąc</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-background-secondary"
              >
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editData.name || !editData.base_url}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Semantic Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-primary border border-border rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Search className="h-5 w-5 text-primary-500" />
                Semantic Search w &quot;{name}&quot;
              </h2>
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchResults(null);
                  setSearchQuery("");
                }}
                className="p-1 hover:bg-background-secondary rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()}
                placeholder="Wpisz zapytanie, np. 'uchwały dotyczące budżetu'"
                className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleSemanticSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Szukaj
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {searchResults && (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">
                    Znaleziono {searchResults.totalFound} dokumentów
                  </p>
                  {searchResults.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="border border-border rounded-lg p-3 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-text-primary">
                            {doc.title}
                          </h4>
                          <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                            {doc.excerpt}
                          </p>
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-500 hover:underline mt-1 inline-flex items-center gap-1"
                            >
                              {doc.url.slice(0, 50)}...
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full ml-2">
                          {Math.round(doc.relevanceScore * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {searchResults.documents.length === 0 && (
                    <p className="text-center text-text-secondary py-8">
                      Brak wyników dla tego zapytania
                    </p>
                  )}
                </div>
              )}
              {!searchResults && !searching && (
                <p className="text-center text-text-secondary py-8">
                  Wpisz zapytanie i kliknij &quot;Szukaj&quot; aby znaleźć
                  dokumenty
                </p>
              )}
              {searching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                  <span className="ml-2 text-text-secondary">
                    Wyszukiwanie...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="border border-border rounded-xl p-4 hover:border-primary-200 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-text-primary">{name}</h3>
              <span
                className={`px-2 py-1 rounded-md text-xs font-medium ${
                  typeColors[type as keyof typeof typeColors]
                }`}
              >
                {type}
              </span>
              {statusIcons[status]}
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:underline flex items-center gap-1"
            >
              {url}
              <ExternalLink className="h-3 w-3" />
            </a>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
              <div>
                <span className="text-text-secondary">Częstotliwość:</span>
                <p className="font-medium">{frequency}</p>
              </div>
              <div>
                <span className="text-text-secondary">Ostatnie:</span>
                <p className="font-medium">{lastScraped}</p>
              </div>
              <div>
                <span className="text-text-secondary">Następne:</span>
                <p className="font-medium">{nextScrape}</p>
              </div>
              <div>
                <span className="text-text-secondary">Dokumenty:</span>
                <p className="font-medium">{documentsCount}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            <div className="flex gap-2">
              <button
                onClick={handleScrape}
                disabled={scraping}
                className="px-3 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Uruchom scraping"
              >
                {scraping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {scraping ? "Scrapuję..." : "Scrapuj"}
              </button>
              <button
                onClick={() => setShowSearchModal(true)}
                className="px-3 py-2 rounded-lg bg-accent-500 text-white hover:bg-accent-600 transition-colors flex items-center gap-2 text-sm font-medium"
                title="Semantic Search - wyszukaj dokumenty"
              >
                <Search className="h-4 w-4" />
                Szukaj
              </button>
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 rounded-lg bg-background-secondary text-text-secondary hover:bg-background-tertiary transition-colors"
                title="Edytuj"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={onToggle}
                className={`p-2 rounded-lg transition-colors ${
                  enabled
                    ? "bg-success/10 text-success hover:bg-success/20"
                    : "bg-background-secondary text-text-secondary hover:bg-background-tertiary"
                }`}
                title={enabled ? "Wyłącz automatyczne" : "Włącz automatyczne"}
              >
                {enabled ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={onDelete}
                className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                title="Usuń"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {scrapeResult && (
              <div
                className={`text-xs px-2 py-1 rounded ${
                  scrapeResult.success
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {scrapeResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PredefinedSourceCard({
  name,
  description,
  category,
  url,
  sourceType,
  onAdd,
}: {
  name: string;
  description: string;
  category: string;
  url: string;
  sourceType: string;
  onAdd: (data: {
    name: string;
    base_url: string;
    source_type: string;
  }) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAdd({ name, base_url: url, source_type: sourceType });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 hover:border-primary-200 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-text-primary">{name}</h4>
            <span className="px-2 py-0.5 bg-background-secondary text-text-secondary text-xs rounded">
              {category}
            </span>
          </div>
          <p className="text-sm text-text-secondary">{description}</p>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="ml-4 px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {adding && <Loader2 className="h-3 w-3 animate-spin" />}
          Dodaj
        </button>
      </div>
    </div>
  );
}

function DocumentsTab({
  documents,
}: {
  documents: ProcessedDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<ProcessedDocument[]>>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Szukaj dokumentów..."
          className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Wszystkie typy</option>
          <option value="resolution">Uchwały</option>
          <option value="protocol">Protokoły</option>
          <option value="news">Aktualności</option>
          <option value="legal_act">Akty prawne</option>
        </select>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Brak pobranych dokumentów</p>
          <p className="text-sm mt-1">Dodaj źródła danych i uruchom scraping</p>
          <button
            onClick={async () => {
              try {
                const result = await seedTestData();
                alert(result.message);
                window.location.reload();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Błąd");
              }
            }}
            className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Wczytaj dane testowe
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="border border-border rounded-lg p-4">
              <h4 className="font-medium">{doc.title}</h4>
              <p className="text-sm text-text-secondary">{doc.document_type}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsTab({ stats }: { stats: DataSourcesStats | null }) {
  if (!stats) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Brak danych statystycznych</p>
      </div>
    );
  }

  const totalDocs = stats.documents?.total || 0;
  const docsByType = stats.documents?.byType || {};

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          label="Źródła aktywne"
          value={String(stats.sources?.active || 0)}
          total={String(stats.sources?.total || 0)}
        />
        <StatCard label="Dokumenty" value={String(totalDocs)} />
        <StatCard
          label="Ostatni scraping"
          value={
            stats.lastScrape ? formatRelativeTime(stats.lastScrape) : "Nigdy"
          }
        />
        <StatCard
          label="Błędy (24h)"
          value={String(stats.errorsLast24h || 0)}
        />
      </div>

      {totalDocs > 0 && (
        <div className="border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Dokumenty według typu</h3>
          <div className="space-y-3">
            {Object.entries(docsByType).map(([type, count]) => (
              <DocumentTypeBar
                key={type}
                label={getDocumentTypeLabel(type)}
                count={count as number}
                total={totalDocs}
                color={getDocumentTypeColor(type)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Przed chwilą";
  if (hours < 24) return `${hours}h temu`;
  const days = Math.floor(hours / 24);
  return `${days}d temu`;
}

function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    resolution: "Uchwały",
    protocol: "Protokoły",
    news: "Aktualności",
    legal_act: "Akty prawne",
    announcement: "Ogłoszenia",
    article: "Artykuły",
  };
  return labels[type] || type;
}

function getDocumentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    resolution: "bg-purple-500",
    protocol: "bg-green-500",
    news: "bg-blue-500",
    legal_act: "bg-red-500",
    announcement: "bg-orange-500",
    article: "bg-cyan-500",
  };
  return colors[type] || "bg-gray-500";
}

function StatCard({
  label,
  value,
  total,
}: {
  label: string;
  value: string;
  total?: string;
}) {
  return (
    <div className="border border-border rounded-xl p-4">
      <p className="text-text-secondary text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">
        {value}
        {total && (
          <span className="text-text-secondary text-base font-normal">
            {" "}
            / {total}
          </span>
        )}
      </p>
    </div>
  );
}

function DocumentTypeBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = (count / total) * 100;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
