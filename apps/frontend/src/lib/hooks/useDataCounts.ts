"use client";

import { useState, useEffect, useCallback } from "react";
import { getDataSourcesStats } from "@/lib/api/data-sources";
import { getProcessingJobs } from "@/lib/api/document-processing";

export interface DataCounts {
  documents: number;
  sources: number;
  activeJobs: number;
  documentsWithEmbeddings: number;
}

interface UseDataCountsOptions {
  refreshInterval?: number; // ms, default 30000 (30s)
  enabled?: boolean;
}

export function useDataCounts(options: UseDataCountsOptions = {}) {
  const { refreshInterval = 30000, enabled = true } = options;

  const [counts, setCounts] = useState<DataCounts>({
    documents: 0,
    sources: 0,
    activeJobs: 0,
    documentsWithEmbeddings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled) return;

    try {
      const [statsData, jobsData] = await Promise.all([
        getDataSourcesStats(),
        getProcessingJobs(),
      ]);

      const activeJobs = jobsData.jobs.filter(
        (j) => !["completed", "failed"].includes(j.status)
      ).length;

      setCounts({
        documents: statsData.documents?.total || 0,
        sources: statsData.sources?.total || 0,
        activeJobs,
        documentsWithEmbeddings: statsData.documents?.withEmbeddings || 0,
      });
      setError(null);
    } catch (err) {
      console.error("[useDataCounts] Error fetching counts:", err);
      setError(err instanceof Error ? err.message : "Błąd pobierania danych");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Initial fetch
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Polling
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    const interval = setInterval(fetchCounts, refreshInterval);
    return () => clearInterval(interval);
  }, [enabled, refreshInterval, fetchCounts]);

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    loading,
    error,
    refresh,
  };
}
