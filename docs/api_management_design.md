# System zarządzania API - Asystent Radnego

## Cel

System zarządzania kluczami API dla OpenAI i lokalnych modeli zgodnych z OpenAI API, z szyfrowaniem kluczy w bazie danych i prostą automatyką.

## Założenia

1. **Bezpieczeństwo**: Klucze API szyfrowane w bazie danych (AES-256-GCM)
2. **Elastyczność**: Obsługa wielu providerów (OpenAI, lokalne modele)
3. **Prostota**: Minimalistyczny interfejs użytkownika
4. **Automatyka**: Automatyczne przełączanie między providerami przy błędach

## Architektura

### 1. Baza danych (PostgreSQL)

```sql
-- Tabela konfiguracji API
CREATE TABLE api_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'openai', 'local', 'azure', etc.
  name VARCHAR(100) NOT NULL, -- Nazwa konfiguracji (np. "OpenAI GPT-4", "Ollama Local")

  -- Szyfrowane dane
  encrypted_api_key TEXT, -- Szyfrowany klucz API
  encryption_key_id VARCHAR(50) NOT NULL, -- ID klucza szyfrującego

  -- Konfiguracja endpointu
  base_url TEXT, -- URL API (dla lokalnych modeli)
  model_name VARCHAR(100), -- Nazwa modelu (gpt-4, llama2, etc.)

  -- Ustawienia
  is_active BOOLEAN DEFAULT false, -- Czy aktywna
  is_default BOOLEAN DEFAULT false, -- Czy domyślna
  priority INTEGER DEFAULT 0, -- Priorytet (wyższy = wyższy priorytet)

  -- Limity i monitoring
  max_tokens INTEGER DEFAULT 4000,
  temperature DECIMAL(3,2) DEFAULT 0.00,
  rate_limit_per_minute INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  UNIQUE(user_id, name)
);

-- Tabela logów użycia API
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES api_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Szczegóły zapytania
  request_type VARCHAR(50), -- 'chat', 'embedding', 'transcription'
  model_used VARCHAR(100),
  tokens_used INTEGER,

  -- Status
  status VARCHAR(20), -- 'success', 'error', 'rate_limited'
  error_message TEXT,
  response_time_ms INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_api_configs_user ON api_configurations(user_id);
CREATE INDEX idx_api_configs_active ON api_configurations(user_id, is_active);
CREATE INDEX idx_api_usage_config ON api_usage_logs(config_id);
CREATE INDEX idx_api_usage_user ON api_usage_logs(user_id, created_at DESC);
```

### 2. Backend API (Fastify)

#### Endpoints

```typescript
// GET /api/v1/ai/configurations
// Lista konfiguracji API użytkownika
// Response: { configurations: ApiConfiguration[] }

// POST /api/v1/ai/configurations
// Utworzenie nowej konfiguracji
// Body: { provider, name, apiKey, baseUrl?, modelName?, ... }
// Response: { configuration: ApiConfiguration }

// PUT /api/v1/ai/configurations/:id
// Aktualizacja konfiguracji
// Body: { name?, apiKey?, isActive?, isDefault?, ... }
// Response: { configuration: ApiConfiguration }

// DELETE /api/v1/ai/configurations/:id
// Usunięcie konfiguracji
// Response: { success: true }

// POST /api/v1/ai/configurations/:id/test
// Test połączenia z API
// Response: { success: boolean, message: string, latency: number }

// GET /api/v1/ai/usage
// Statystyki użycia API
// Query: { from?, to?, configId? }
// Response: { usage: UsageStats[] }
```

#### Szyfrowanie kluczy API

```typescript
// apps/api/src/lib/encryption.ts
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Klucz główny z zmiennej środowiskowej
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY!;

export function encryptApiKey(apiKey: string): {
  encrypted: string;
  keyId: string;
} {
  // Generuj IV (initialization vector)
  const iv = crypto.randomBytes(IV_LENGTH);

  // Utwórz cipher
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(MASTER_KEY, "hex"),
    iv
  );

  // Szyfruj
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Pobierz auth tag
  const authTag = cipher.getAuthTag();

  // Połącz IV + encrypted + authTag
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, "hex"),
    authTag,
  ]).toString("base64");

  return {
    encrypted: combined,
    keyId: "master-v1", // Wersjonowanie kluczy
  };
}

export function decryptApiKey(encryptedData: string, keyId: string): string {
  // Dekoduj base64
  const combined = Buffer.from(encryptedData, "base64");

  // Wyodrębnij IV, encrypted, authTag
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(
    IV_LENGTH,
    combined.length - AUTH_TAG_LENGTH
  );

  // Utwórz decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(MASTER_KEY, "hex"),
    iv
  );

  decipher.setAuthTag(authTag);

  // Deszyfruj
  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

#### Service do zarządzania AI

```typescript
// apps/api/src/services/ai-config.service.ts
import { encryptApiKey, decryptApiKey } from "../lib/encryption";
import { db } from "../lib/database";

export class AIConfigService {
  async createConfiguration(
    userId: string,
    data: {
      provider: string;
      name: string;
      apiKey: string;
      baseUrl?: string;
      modelName?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ) {
    // Szyfruj klucz API
    const { encrypted, keyId } = encryptApiKey(data.apiKey);

    // Jeśli to pierwsza konfiguracja, ustaw jako domyślną
    const existingCount = await db.query(
      "SELECT COUNT(*) FROM api_configurations WHERE user_id = $1",
      [userId]
    );
    const isDefault = existingCount.rows[0].count === "0";

    // Zapisz do bazy
    const result = await db.query(
      `
      INSERT INTO api_configurations (
        user_id, provider, name, encrypted_api_key, encryption_key_id,
        base_url, model_name, max_tokens, temperature, is_default, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      RETURNING *
    `,
      [
        userId,
        data.provider,
        data.name,
        encrypted,
        keyId,
        data.baseUrl,
        data.modelName,
        data.maxTokens || 4000,
        data.temperature || 0.0,
        isDefault,
      ]
    );

    return this.sanitizeConfig(result.rows[0]);
  }

  async getActiveConfiguration(userId: string) {
    // Pobierz domyślną aktywną konfigurację
    const result = await db.query(
      `
      SELECT * FROM api_configurations
      WHERE user_id = $1 AND is_active = true
      ORDER BY is_default DESC, priority DESC
      LIMIT 1
    `,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error("No active API configuration found");
    }

    return this.decryptConfig(result.rows[0]);
  }

  async testConfiguration(configId: string, userId: string) {
    const config = await this.getConfiguration(configId, userId);
    const startTime = Date.now();

    try {
      // Test połączenia z API
      const response = await fetch(`${config.baseUrl}/v1/models`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      return {
        success: true,
        message: "Connection successful",
        latency,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        latency: Date.now() - startTime,
      };
    }
  }

  private decryptConfig(config: any) {
    return {
      ...config,
      apiKey: decryptApiKey(config.encrypted_api_key, config.encryption_key_id),
      encrypted_api_key: undefined,
      encryption_key_id: undefined,
    };
  }

  private sanitizeConfig(config: any) {
    // Usuń wrażliwe dane przed wysłaniem do frontendu
    const { encrypted_api_key, encryption_key_id, ...safe } = config;
    return safe;
  }
}
```

### 3. Frontend

#### Strona konfiguracji API

```typescript
// apps/frontend/src/app/settings/api/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Key, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";

interface ApiConfig {
  id: string;
  provider: string;
  name: string;
  baseUrl?: string;
  modelName?: string;
  isActive: boolean;
  isDefault: boolean;
  lastUsedAt?: string;
}

export default function ApiSettingsPage() {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Pobierz konfiguracje
  useEffect(() => {
    fetchConfigurations();
  }, []);

  async function fetchConfigurations() {
    const response = await fetch("/api/v1/ai/configurations");
    const data = await response.json();
    setConfigs(data.configurations);
  }

  async function testConnection(configId: string) {
    const response = await fetch(`/api/v1/ai/configurations/${configId}/test`, {
      method: "POST",
    });
    const result = await response.json();

    if (result.success) {
      alert(`Połączenie udane! Opóźnienie: ${result.latency}ms`);
    } else {
      alert(`Błąd: ${result.message}`);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Konfiguracja API</h1>
          <p className="text-text-secondary mt-2">
            Zarządzaj kluczami API dla OpenAI i lokalnych modeli
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Plus className="h-5 w-5" />
          Dodaj konfigurację
        </button>
      </div>

      {/* Lista konfiguracji */}
      <div className="space-y-4">
        {configs.map((config) => (
          <ConfigCard
            key={config.id}
            config={config}
            onTest={() => testConnection(config.id)}
            onDelete={() => deleteConfig(config.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

## Automatyka i fail-over

### Strategia przełączania providerów

```typescript
// apps/api/src/services/ai-provider.service.ts
export class AIProviderService {
  async executeWithFailover(
    userId: string,
    operation: (config: ApiConfig) => Promise<any>
  ) {
    // Pobierz wszystkie aktywne konfiguracje posortowane po priorytecie
    const configs = await this.getActiveConfigurations(userId);

    let lastError: Error | null = null;

    for (const config of configs) {
      try {
        // Spróbuj wykonać operację
        const result = await operation(config);

        // Zaloguj sukces
        await this.logUsage(config.id, userId, "success");

        // Zaktualizuj last_used_at
        await this.updateLastUsed(config.id);

        return result;
      } catch (error) {
        lastError = error;

        // Zaloguj błąd
        await this.logUsage(config.id, userId, "error", error.message);

        // Jeśli rate limit, spróbuj następnego providera
        if (error.message.includes("rate_limit")) {
          continue;
        }

        // Jeśli inny błąd, rzuć wyjątek
        throw error;
      }
    }

    // Wszystkie providery zawiodły
    throw new Error(
      `All API providers failed. Last error: ${lastError?.message}`
    );
  }
}
```

## Zmienne środowiskowe

```bash
# .env (backend)
ENCRYPTION_MASTER_KEY=<64-character-hex-string>  # openssl rand -hex 32
DATABASE_URL=postgresql://...
```

## Migracja bazy danych

```sql
-- apps/api/migrations/001_create_api_configurations.sql
-- (zawartość z sekcji "Baza danych" powyżej)
```

## TODO - Implementacja

1. [ ] Utworzyć migrację bazy danych
2. [ ] Zaimplementować szyfrowanie/deszyfrowanie w backend
3. [ ] Utworzyć endpoints API w Fastify
4. [ ] Utworzyć stronę `/settings/api` w frontend
5. [ ] Dodać komponent formularza dodawania konfiguracji
6. [ ] Zaimplementować fail-over w AI service
7. [ ] Dodać monitoring i logi użycia
8. [ ] Testy jednostkowe i integracyjne

## Bezpieczeństwo

1. **Klucz główny**: Przechowywany tylko w zmiennej środowiskowej, nigdy w repo
2. **Szyfrowanie**: AES-256-GCM z authentication tag
3. **Wersjonowanie kluczy**: Możliwość rotacji klucza głównego
4. **RLS**: Row Level Security w Supabase dla api_configurations
5. **HTTPS**: Wymagane dla wszystkich połączeń API
6. **Rate limiting**: Ochrona przed nadużyciami

---

**Status**: Projekt gotowy do implementacji
**Data**: 2024-12-27
