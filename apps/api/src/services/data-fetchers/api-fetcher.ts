/**
 * API Fetcher - uniwersalny klient API dla zewnętrznych źródeł
 * Agent AI "Winsdurf" - pobieranie danych z API (ISAP, WSA/NSA, RIO, etc.)
 */

/* eslint-disable no-undef */
declare const fetch: typeof globalThis.fetch;
declare const URL: typeof globalThis.URL;
declare const AbortSignal: typeof globalThis.AbortSignal;

import { BaseDataFetcher } from "./base-fetcher.js";
import type {
  DataSourceConfig,
  FetchedDocument,
  ApiClientConfig,
} from "@shared/types/data-sources-api";

export class ApiDataFetcher extends BaseDataFetcher {
  private apiConfig: ApiClientConfig;
  private fetchedDocuments: FetchedDocument[] = [];

  constructor(config: DataSourceConfig) {
    super(config);

    if (!config.apiConfig) {
      throw new Error("API configuration is required for API fetcher");
    }

    this.apiConfig = config.apiConfig;
  }

  async fetch(): Promise<FetchedDocument[]> {
    console.log(`[API Fetcher] Starting fetch for ${this.config.name}`);

    try {
      // Uwierzytelnienie jeśli wymagane
      await this.authenticate();

      // Pobierz dane z API
      const data = await this.fetchData();

      // Przetwórz odpowiedź
      this.fetchedDocuments = this.processResponse(data);

      console.log(
        `[API Fetcher] Fetched ${this.fetchedDocuments.length} documents`
      );

      return this.fetchedDocuments;
    } catch (error) {
      this.logError("API fetch failed", error);
      return [];
    }
  }

  private async authenticate(): Promise<void> {
    if (
      !this.apiConfig.authentication ||
      this.apiConfig.authentication.type === "none"
    ) {
      return;
    }

    const auth = this.apiConfig.authentication;

    switch (auth.type) {
      case "oauth2":
        if (auth.oauth2Config) {
          await this.authenticateOAuth2(auth.oauth2Config);
        }
        break;
      // Inne typy uwierzytelnienia są obsługiwane w headers
      default:
        break;
    }
  }

  private async authenticateOAuth2(
    config: NonNullable<ApiClientConfig["authentication"]>["oauth2Config"]
  ): Promise<void> {
    if (!config) return;

    try {
      const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: config.scope || "",
        }),
      });

      if (!response.ok) {
        throw new Error(`OAuth2 authentication failed: ${response.status}`);
      }

      const data = (await response.json()) as { access_token: string };

      // Zapisz token do użycia w kolejnych requestach
      if (!this.apiConfig.headers) {
        this.apiConfig.headers = {};
      }
      this.apiConfig.headers["Authorization"] = `Bearer ${data.access_token}`;
    } catch (error) {
      this.logError("OAuth2 authentication failed", error);
      throw error;
    }
  }

  private async fetchData(): Promise<unknown> {
    const url = this.buildUrl();
    const headers = this.buildHeaders();
    const options: RequestInit = {
      method: this.apiConfig.method,
      headers,
      signal: AbortSignal.timeout(30000),
    };

    if (this.apiConfig.method !== "GET" && this.apiConfig.bodyTemplate) {
      options.body = JSON.stringify(this.apiConfig.bodyTemplate);
    }

    console.log(`[API Fetcher] Requesting: ${url}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await response.json();
    } else if (
      contentType.includes("application/xml") ||
      contentType.includes("text/xml")
    ) {
      return await response.text();
    } else {
      return await response.text();
    }
  }

  private buildUrl(): string {
    let url = this.apiConfig.baseUrl;

    if (this.apiConfig.endpoint) {
      url = url.endsWith("/")
        ? url + this.apiConfig.endpoint
        : `${url}/${this.apiConfig.endpoint}`;
    }

    // Dodaj query params
    if (
      this.apiConfig.queryParams &&
      Object.keys(this.apiConfig.queryParams).length > 0
    ) {
      const params = new URLSearchParams(this.apiConfig.queryParams);
      url = `${url}?${params.toString()}`;
    }

    return url;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Asystent-Radnego/1.0",
      ...this.apiConfig.headers,
    };

    // Dodaj uwierzytelnienie
    if (this.apiConfig.authentication) {
      const auth = this.apiConfig.authentication;

      switch (auth.type) {
        case "api_key":
          if (auth.apiKey && auth.apiKeyHeader) {
            headers[auth.apiKeyHeader] = auth.apiKey;
          }
          break;
        case "bearer":
          if (auth.token) {
            headers["Authorization"] = `Bearer ${auth.token}`;
          }
          break;
        case "basic":
          if (auth.username && auth.password) {
            const credentials = Buffer.from(
              `${auth.username}:${auth.password}`
            ).toString("base64");
            headers["Authorization"] = `Basic ${credentials}`;
          }
          break;
      }
    }

    return headers;
  }

  private processResponse(data: unknown): FetchedDocument[] {
    const documents: FetchedDocument[] = [];

    try {
      // Wyciągnij dane z odpowiedzi używając responseMapping
      const items = this.extractDataFromPath(
        data,
        this.apiConfig.responseMapping?.dataPath || ""
      );

      if (!Array.isArray(items)) {
        this.logWarning("Response data is not an array, wrapping in array");
        return this.processItem(items);
      }

      for (const item of items) {
        const processed = this.processItem(item);
        documents.push(...processed);
      }
    } catch (error) {
      this.logError("Failed to process response", error);
    }

    return documents;
  }

  private processItem(item: unknown): FetchedDocument[] {
    try {
      const mapping = this.apiConfig.responseMapping;

      const title = mapping?.titlePath
        ? String(this.extractDataFromPath(item, mapping.titlePath))
        : "Untitled";

      const content = mapping?.contentPath
        ? String(this.extractDataFromPath(item, mapping.contentPath))
        : JSON.stringify(item);

      const url = mapping?.urlPath
        ? String(this.extractDataFromPath(item, mapping.urlPath))
        : undefined;

      const publishDate = mapping?.datePath
        ? String(this.extractDataFromPath(item, mapping.datePath))
        : undefined;

      const document: FetchedDocument = {
        sourceId: this.config.id,
        sourceType: this.config.sourceType,
        fetchMethod: "api",
        title,
        content,
        contentType: "json",
        url,
        publishDate,
        contentHash: this.generateContentHash(content),
        fetchedAt: new Date().toISOString(),
        rawData: item as Record<string, unknown>,
      };

      return [document];
    } catch (error) {
      this.logError("Failed to process item", error);
      return [];
    }
  }

  private extractDataFromPath(data: unknown, path: string): unknown {
    if (!path) return data;

    const parts = path.split(".");
    let current: any = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}
