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
  ListChecks,
} from "lucide-react";
import {
  getDataSources,
  getDataSourcesStats,
  getSourceDocuments,
  updateDataSource,
  deleteDataSource,
  triggerScraping,
  triggerScrapingAllQueue,
  createDataSource,
  seedTestData,
  type DataSource,
  type DataSourcesStats,
  type ProcessedDocument,
} from "@/lib/api/data-sources";
import { saveGUSApiKey } from "@/lib/api/gus";
import { useToast } from "@/lib/notifications/toast";
import { useDataCounts } from "@/lib/hooks/useDataCounts";

export default function DataSourcesPage() {
  const [activeTab, setActiveTab] = useState<"sources" | "documents" | "stats">(
    "sources",
  );
  const [sources, setSources] = useState<DataSource[]>([]);
  const [stats, setStats] = useState<DataSourcesStats | null>(null);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGusApiKeyDialog, setShowGusApiKeyDialog] = useState(false);
  const toast = useToast();
  const { counts, refresh: refreshCounts } = useDataCounts({
    refreshInterval: 15000,
  });

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
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Źródła Danych</h1>
        <p className="text-text-secondary mt-1">
          Zarządzaj źródłami danych dla Asystenta AI
        </p>
      </div>

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
            Źródła ({counts.sources})
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
            Dokumenty ({counts.documents})
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

      {activeTab === "sources" && (
        <SourcesTab
          sources={sources}
          showGusApiKeyDialog={showGusApiKeyDialog}
          setShowGusApiKeyDialog={setShowGusApiKeyDialog}
          onRefresh={() => {
            loadData();
            refreshCounts();
          }}
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
            try {
              toast.info(
                "Rozpoczęto scraping",
                `Pobieranie danych ze źródła: ${source?.name}`,
              );
              const result = await triggerScraping(id);
              if (result.status === "success" || result.status === "ok") {
                toast.success(
                  "Scraping zakończony",
                  result.message || "Dane pobrane",
                );
              }
              setTimeout(() => loadData(), 2000);
            } catch (error) {
              toast.error(
                "Błąd scrapingu",
                error instanceof Error ? error.message : "Nieznany błąd",
              );
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
  showGusApiKeyDialog,
  setShowGusApiKeyDialog,
  onRefresh,
  onToggle,
  onDelete,
  onScrape,
  onAdd,
}: {
  sources: DataSource[];
  showGusApiKeyDialog: boolean;
  setShowGusApiKeyDialog: (show: boolean) => void;
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
    fetch_method: "scraping" as const,
  });
  const [adding, setAdding] = useState(false);
  const [scrapingAll, setScrapingAll] = useState(false);
  const toast = useToast();

  // Typy źródeł API (nie wymagają scrapingu)
  const API_SOURCE_TYPES = [
    "youtube",
    "youtube_channel",
    "api",
    "statistical",
    "legal",
    "registry",
    "environmental",
    "funding",
    "spatial",
  ];
  const scrapableSources = sources.filter(
    (s) => !API_SOURCE_TYPES.includes(s.source_type),
  );

  const handleScrapeAll = async () => {
    if (scrapableSources.length === 0) {
      toast.warning("Brak źródeł", "Nie ma źródeł do scrapowania");
      return;
    }

    setScrapingAll(true);
    try {
      const result = await triggerScrapingAllQueue({ excludeApiSources: true });
      toast.success(
        "Dodano do kolejki",
        `${result.queued} źródeł dodano do kolejki scrapingu`,
      );
      setTimeout(() => onRefresh(), 2000);
    } catch (error) {
      toast.error(
        "Błąd kolejkowania",
        error instanceof Error ? error.message : "Nieznany błąd",
      );
    } finally {
      setScrapingAll(false);
    }
  };

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
        fetch_method: "scraping",
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
    return `${Math.floor(hours / 24)}d temu`;
  };

  return (
    <div className="space-y-4">
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
                  placeholder="np. BIP Gminy"
                  className="w-full px-3 py-2 border border-border rounded-lg"
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
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-border rounded-lg"
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
                  className="w-full px-3 py-2 border border-border rounded-lg"
                >
                  <option value="scraper_bip">BIP</option>
                  <option value="municipality">Gmina</option>
                  <option value="legal">Prawne</option>
                  <option value="councilor">Radny</option>
                  <option value="youtube">YouTube</option>
                  <option value="statistics">Statystyki</option>
                  <option value="funding">Dotacje UE</option>
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
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Dodaj źródło
        </button>
        <button
          onClick={handleScrapeAll}
          disabled={scrapingAll || scrapableSources.length === 0}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
          title={`Scrapuj ${scrapableSources.length} źródeł (bez API)`}
        >
          {scrapingAll ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ListChecks className="h-4 w-4" />
          )}
          Scrapuj wszystkie ({scrapableSources.length})
        </button>
      </div>

      <div className="grid gap-4">
        {sources.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Brak skonfigurowanych źródeł danych</p>
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

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">
          Dostępne źródła do dodania
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <PredefinedSourceCard
            name="Portal Samorządowy"
            description="Informacje dla samorządowców"
            category="Dla radnych"
            url="https://www.portalsamorzadowy.pl"
            sourceType="councilor"
            onAdd={onAdd}
          />
          <GUSSourceCard
            showApiKeyDialog={showGusApiKeyDialog}
            setShowApiKeyDialog={setShowGusApiKeyDialog}
          />
          <PredefinedSourceCard
            name="ISAP - Dziennik Ustaw i Monitor Polski"
            description="Oficjalne akty prawne RP z API Sejmu"
            category="Prawo"
            url="https://isap.sejm.gov.pl"
            sourceType="legal"
            onAdd={onAdd}
            badge="API"
          />
          <PredefinedSourceCard
            name="Fundusze Europejskie"
            description="Nabory, konkursy i projekty UE"
            category="Dotacje UE"
            url="https://www.funduszeeuropejskie.gov.pl"
            sourceType="funding"
            onAdd={onAdd}
            badge="API"
          />
          <PredefinedSourceCard
            name="Geoportal - Dane Przestrzenne"
            description="Działki, MPZP, granice administracyjne"
            category="Mapy"
            url="https://geoportal.gov.pl"
            sourceType="spatial"
            onAdd={onAdd}
            badge="API"
          />
          <PredefinedSourceCard
            name="TERYT - Jednostki Terytorialne"
            description="Gminy, powiaty, województwa - rejestr GUS"
            category="Rejestry"
            url="https://api-teryt.stat.gov.pl"
            sourceType="statistics"
            onAdd={onAdd}
            badge="API"
          />
          <PredefinedSourceCard
            name="KRS - Krajowy Rejestr Sądowy"
            description="Spółki, stowarzyszenia, fundacje"
            category="Rejestry"
            url="https://api-krs.ms.gov.pl"
            sourceType="statistics"
            onAdd={onAdd}
            badge="API"
          />
          <PredefinedSourceCard
            name="CEIDG - Działalność Gospodarcza"
            description="Jednoosobowa działalność gospodarcza"
            category="Rejestry"
            url="https://dane.biznes.gov.pl"
            sourceType="statistics"
            onAdd={onAdd}
            badge="API"
          />
          <PredefinedSourceCard
            name="GDOŚ - Dane Środowiskowe"
            description="Obszary chronione, Natura 2000"
            category="Środowisko"
            url="https://sdi.gdos.gov.pl"
            sourceType="statistics"
            onAdd={onAdd}
            badge="API"
          />
          <PredefinedSourceCard
            name="YouTube - Sesje Rady"
            description="Transkrypcje z nagrań sesji"
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    name,
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
    try {
      await onScrape();
    } finally {
      setScraping(false);
    }
  };

  const typeColors: Record<string, string> = {
    municipality: "bg-blue-100 text-blue-700",
    bip: "bg-purple-100 text-purple-700",
    legal: "bg-green-100 text-green-700",
    spatial: "bg-emerald-100 text-emerald-700",
    registry: "bg-indigo-100 text-indigo-700",
    environmental: "bg-lime-100 text-lime-700",
    councilor: "bg-orange-100 text-orange-700",
    statistics: "bg-pink-100 text-pink-700",
    youtube: "bg-red-100 text-red-700",
    funding: "bg-cyan-100 text-cyan-700",
  };

  const statusIcons = {
    success: <CheckCircle className="h-4 w-4 text-success" />,
    error: <XCircle className="h-4 w-4 text-danger" />,
    skipped: <Clock className="h-4 w-4 text-text-secondary" />,
  };

  return (
    <>
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-primary border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edytuj źródło</h2>
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
                  className="w-full px-3 py-2 border border-border rounded-lg"
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
                  className="w-full px-3 py-2 border border-border rounded-lg"
                />
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
                disabled={saving}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Zapisz
              </button>
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
                  typeColors[type] || "bg-gray-100 text-gray-700"
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
          <div className="flex gap-2 ml-4">
            <button
              onClick={handleScrape}
              disabled={scraping}
              className="px-3 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {scraping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {scraping ? "..." : "Scrapuj"}
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded-lg bg-background-secondary text-text-secondary hover:bg-background-tertiary"
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
            >
              {enabled ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
  badge,
}: {
  name: string;
  description: string;
  category: string;
  url: string;
  sourceType: string;
  badge?: string;
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
            {badge && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary">{description}</p>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="ml-4 px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-1"
        >
          {adding && <Loader2 className="h-3 w-3 animate-spin" />}Dodaj
        </button>
      </div>
    </div>
  );
}

function GUSSourceCard({
  showApiKeyDialog,
  setShowApiKeyDialog,
}: {
  onAdd?: (data: {
    name: string;
    base_url: string;
    source_type: string;
  }) => Promise<void>;
  showApiKeyDialog: boolean;
  setShowApiKeyDialog: (show: boolean) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const toast = useToast();

  // GUS jest teraz predefiniowany jako API - od razu otwieramy dialog klucza
  const handleConfigure = () => {
    setShowApiKeyDialog(true);
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.warning("Podaj klucz API");
      return;
    }
    setSavingKey(true);
    try {
      await saveGUSApiKey(apiKey);
      toast.success("Klucz API zapisany", "Możesz teraz korzystać z API GUS");
      setShowApiKeyDialog(false);
      setApiKey("");
    } catch (error) {
      toast.error(
        "Błąd zapisu",
        error instanceof Error ? error.message : "Nie udało się zapisać klucza",
      );
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <>
      <div className="border border-border rounded-lg p-4 hover:border-primary-200 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-text-primary">
                GUS - Bank Danych Lokalnych
              </h4>
              <span className="px-2 py-0.5 bg-background-secondary text-text-secondary text-xs rounded">
                Statystyki
              </span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                API
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              Dane demograficzne, ekonomiczne, społeczne
            </p>
          </div>
          <button
            onClick={handleConfigure}
            className="ml-4 px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 flex items-center gap-1"
          >
            Konfiguruj
          </button>
        </div>
      </div>

      {showApiKeyDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-primary border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Klucz API GUS</h2>
              <button
                onClick={() => setShowApiKeyDialog(false)}
                className="p-1 hover:bg-background-secondary rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Aby korzystać z API GUS, potrzebujesz klucza API. Zarejestruj
                się na{" "}
                <a
                  href="https://api.stat.gov.pl/Home/BdlApi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 hover:underline"
                >
                  api.stat.gov.pl
                </a>
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Klucz API GUS
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Wklej swój klucz API..."
                  className="w-full px-3 py-2 border border-border rounded-lg font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowApiKeyDialog(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-background-secondary"
              >
                Pomiń
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={savingKey || !apiKey.trim()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
              >
                {savingKey && <Loader2 className="h-4 w-4 animate-spin" />}
                Zapisz klucz
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DocumentsTab({
  documents,
  setDocuments,
}: {
  documents: ProcessedDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<ProcessedDocument[]>>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const toast = useToast();

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Czy na pewno chcesz usunąć WSZYSTKIE dokumenty z bazy RAG? Tej operacji nie można cofnąć.",
      )
    )
      return;

    try {
      const { deleteAllDocuments } = await import("@/lib/api/data-sources");
      const res = await deleteAllDocuments();
      toast.success("Usunięto", res.message || "Wyczyszczono bazę RAG");
      setDocuments([]);
    } catch (e) {
      toast.error(
        "Błąd",
        e instanceof Error ? e.message : "Nie udało się usunąć dokumentów",
      );
    }
  };

  const handleDeleteSingle = async (id: string, title: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć dokument "${title}"?`)) return;
    try {
      const { deleteDocument } = await import("@/lib/api/data-sources");
      await deleteDocument(id);
      toast.success("Usunięto", `Dokument "${title}" został usunięty`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      toast.error(
        "Błąd",
        e instanceof Error ? e.message : "Nie udało się usunąć dokumentu",
      );
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      !searchTerm || doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || doc.document_type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="Szukaj dokumentów..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-border rounded-lg"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg"
        >
          <option value="">Wszystkie typy</option>
          <option value="resolution">Uchwały</option>
          <option value="protocol">Protokoły</option>
          <option value="news">Aktualności</option>
        </select>
        {documents.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="px-4 py-2 border border-border text-danger hover:bg-red-50 rounded-lg flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Usuń wszystkie (RAG)
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Brak pobranych dokumentów</p>
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
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="border border-border rounded-lg p-4 flex items-start gap-3"
            >
              <div className="flex-1">
                <h4 className="font-medium">{doc.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 bg-background-secondary rounded">
                    {doc.document_type}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {doc.content ? (
                      `${doc.content.length} znaków`
                    ) : (
                      <span className="text-warning">Brak treści</span>
                    )}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteSingle(doc.id, doc.title)}
                className="p-2 text-text-secondary hover:text-danger hover:bg-red-50 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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
                label={type}
                count={count as number}
                total={totalDocs}
                color="bg-primary-500"
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
  return `${Math.floor(hours / 24)}d temu`;
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
