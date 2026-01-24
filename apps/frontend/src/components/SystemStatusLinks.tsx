"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { Activity, Cog } from "lucide-react";

interface ServiceStatus {
  label: string;
  url: string;
  icon: JSX.Element;
  status: "loading" | "ok" | "error";
}

const DEFAULT_ENDPOINTS = {
  api:
    process.env.NEXT_PUBLIC_API_HEALTH_URL ||
    "https://api.ozzilab.online/health",
  worker:
    process.env.NEXT_PUBLIC_WORKER_HEALTH_URL ||
    process.env.NEXT_PUBLIC_API_HEALTH_URL ||
    "https://api.ozzilab.online/health",
};

const STATUS_COLORS: Record<ServiceStatus["status"], string> = {
  ok: "text-sky-600 hover:text-sky-700",
  error: "text-red-600 hover:text-red-700",
  loading: "text-muted-foreground",
};

async function checkEndpoint(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    return res.ok;
  } catch (err) {
    console.warn(`Health check failed for ${url}:`, err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function SystemStatusLinks() {
  const initialServices = useMemo(
    () => ({
      api: {
        label: "API (api.ozzilab.online)",
        url: DEFAULT_ENDPOINTS.api,
        icon: <Activity className="h-4 w-4" />,
        status: "loading" as const,
      },
      worker: {
        label: "Worker",
        url: DEFAULT_ENDPOINTS.worker,
        icon: <Cog className="h-4 w-4" />,
        status: "loading" as const,
      },
    }),
    [],
  );

  const [services, setServices] =
    useState<Record<string, ServiceStatus>>(initialServices);

  useEffect(() => {
    const runChecks = async () => {
      const entries = Object.entries(initialServices);
      const results = await Promise.all(
        entries.map(async ([key, svc]) => {
          const ok = await checkEndpoint(svc.url);
          return [key, { ...svc, status: ok ? "ok" : ("error" as const) }];
        }),
      );
      setServices(Object.fromEntries(results));
    };

    runChecks();
    const interval = setInterval(runChecks, 30000);
    return () => clearInterval(interval);
  }, [initialServices]);

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6 opacity-75">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
          Status systemów:
        </span>
        {Object.entries(services).map(([key, svc]) => (
          <div
            key={key}
            className={`flex items-center gap-2 text-sm transition-colors ${STATUS_COLORS[svc.status]}`}
            title={
              svc.status === "ok"
                ? "Działa"
                : svc.status === "error"
                  ? "Niedostępne"
                  : "Sprawdzanie"
            }
            aria-label={`${svc.label}: ${svc.status}`}
          >
            {svc.icon}
            {svc.label}
          </div>
        ))}
      </div>
    </div>
  );
}
