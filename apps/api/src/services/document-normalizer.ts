/**
 * Document Normalizer Service
 *
 * Inteligentna normalizacja chaotycznych danych źródłowych do ustandaryzowanego formatu.
 * LLM analizuje surowe dane i wyodrębnia strukturalne metadane.
 *
 * FILOZOFIA: Uporządkuj chaos NA WEJŚCIU, nie walcz z nim NA WYJŚCIU.
 */

import OpenAI from "openai";
import { getLLMClient, getAIConfig } from "../ai/index.js";

// ============================================================================
// USTANDARYZOWANY SCHEMAT METADANYCH
// ============================================================================

/**
 * Znormalizowane metadane dokumentu - JEDNOLITY FORMAT dla wszystkich źródeł
 */
export interface NormalizedDocumentMetadata {
  // Identyfikacja dokumentu
  documentType: DocumentType;
  documentSubtype?: string; // np. "uchwała budżetowa", "protokół zwyczajny"

  // Poziom hierarchii (1-5, gdzie 1 = najważniejszy)
  hierarchyLevel: 1 | 2 | 3 | 4 | 5;

  // Powiązanie z sesją (jeśli dotyczy)
  sessionInfo?: {
    sessionNumber: number; // ZAWSZE liczba arabska (23, nie XXIII)
    sessionType?: SessionType; // zwyczajna, nadzwyczajna, budżetowa
    sessionDate?: string; // ISO 8601
  };

  // Identyfikatory dokumentów
  documentNumber?: string; // np. "123/2024", "XV/123/24"

  // Daty
  publishDate?: string; // ISO 8601
  effectiveDate?: string; // Data wejścia w życie

  // Klasyfikacja tematyczna
  topics: string[]; // Znormalizowane tematy
  keywords: string[]; // Kluczowe słowa

  // Osoby
  people?: {
    authors?: string[]; // Autorzy/wnioskodawcy
    speakers?: string[]; // Mówcy (dla transkrypcji)
    mentioned?: string[]; // Wymienione osoby
  };

  // Lokalizacja w strukturze
  source: {
    origin: string; // "BIP", "YouTube", "System Rada", etc.
    url?: string;
    scrapedAt: string; // ISO 8601
  };

  // Jakość danych
  confidence: {
    overall: number; // 0-100%
    sessionNumber?: number; // Pewność identyfikacji sesji
    documentType?: number; // Pewność typu dokumentu
  };

  // Dodatkowe metadane specyficzne dla typu
  extra?: Record<string, unknown>;
}

export type DocumentType =
  | "budget_act" // Uchwała budżetowa
  | "resolution" // Uchwała
  | "session_order" // Porządek obrad
  | "resolution_project" // Projekt uchwały
  | "protocol" // Protokół
  | "interpellation" // Interpelacja
  | "transcription" // Transkrypcja
  | "video" // Nagranie wideo
  | "committee_opinion" // Opinia komisji
  | "justification" // Uzasadnienie
  | "session_materials" // Materiały sesji
  | "order" // Zarządzenie
  | "announcement" // Obwieszczenie
  | "attachment" // Załącznik
  | "reference_material" // Materiał referencyjny
  | "news" // Aktualności
  | "report" // Sprawozdanie
  | "opinion" // Opinia (ogólna)
  | "motion" // Wniosek
  | "other";

export type SessionType =
  | "ordinary" // Zwyczajna
  | "extraordinary" // Nadzwyczajna
  | "budget" // Budżetowa
  | "constituent"; // Konstytucyjna

// ============================================================================
// MAPOWANIE TYPÓW DOKUMENTÓW NA POZIOMY HIERARCHII
// ============================================================================

const DOCUMENT_HIERARCHY_LEVELS: Record<DocumentType, number> = {
  budget_act: 1,
  resolution: 1,
  session_order: 1,
  resolution_project: 2,
  protocol: 2,
  interpellation: 2,
  transcription: 2,
  video: 3,
  committee_opinion: 3,
  justification: 3,
  session_materials: 3,
  order: 4,
  announcement: 4,
  attachment: 5,
  reference_material: 5,
  news: 5,
  report: 5,
  opinion: 5,
  motion: 5,
  other: 5,
};

// ============================================================================
// DOCUMENT NORMALIZER CLASS
// ============================================================================

export class DocumentNormalizer {
  private llmClient: OpenAI | null = null;
  private modelName: string = "gpt-4o-mini";
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async initialize(): Promise<void> {
    this.llmClient = await getLLMClient(this.userId);
    const config = await getAIConfig(this.userId, "llm");
    this.modelName = config.modelName;

    console.log(
      `[DocumentNormalizer] Initialized with model: ${this.modelName}`
    );
  }

  /**
   * Główna metoda - normalizuje surowe dane dokumentu
   */
  async normalize(rawDocument: {
    title: string;
    content?: string;
    url?: string;
    sourceType: string; // "BIP", "YouTube", "System Rada"
    rawMetadata?: Record<string, unknown>;
  }): Promise<NormalizedDocumentMetadata> {
    if (!this.llmClient) {
      await this.initialize();
    }

    console.log(
      `[DocumentNormalizer] Normalizing: "${rawDocument.title.substring(
        0,
        60
      )}..."`
    );

    // Użyj LLM do inteligentnej ekstrakcji metadanych
    const normalized = await this.extractMetadataWithLLM(rawDocument);

    // Walidacja i post-processing
    const validated = this.validateAndEnrich(normalized, rawDocument);

    console.log(
      `[DocumentNormalizer] Result: type=${validated.documentType}, session=${
        validated.sessionInfo?.sessionNumber || "N/A"
      }, confidence=${validated.confidence.overall}%`
    );

    return validated;
  }

  /**
   * LLM wyodrębnia strukturalne metadane z chaotycznych danych
   */
  private async extractMetadataWithLLM(rawDocument: {
    title: string;
    content?: string;
    url?: string;
    sourceType: string;
    rawMetadata?: Record<string, unknown>;
  }): Promise<NormalizedDocumentMetadata> {
    const prompt = `Jesteś ekspertem od analizy dokumentów samorządowych. Twoim zadaniem jest wyodrębnienie strukturalnych metadanych z surowych danych dokumentu.

SUROWE DANE:
Tytuł: ${rawDocument.title}
Źródło: ${rawDocument.sourceType}
URL: ${rawDocument.url || "brak"}
${
  rawDocument.content
    ? `Treść (fragment): ${rawDocument.content.substring(0, 500)}...`
    : ""
}

ZADANIE:
Wyodrębnij następujące informacje w formacie JSON:

1. **documentType** - typ dokumentu (wybierz JEDEN):
   - "budget_act" - uchwała budżetowa, WPF, zmiany w budżecie (NAJWAŻNIEJSZE)
   - "resolution" - uchwała (prawo miejscowe)
   - "session_order" - porządek obrad
   - "resolution_project" - projekt uchwały
   - "protocol" - protokół z sesji
   - "interpellation" - interpelacja lub zapytanie radnego
   - "transcription" - transkrypcja nagrania
   - "video" - nagranie wideo
   - "committee_opinion" - opinia komisji
   - "justification" - uzasadnienie do uchwały
   - "session_materials" - inne materiały sesyjne
   - "order" - zarządzenie Burmistrza/Wójta
   - "announcement" - ogłoszenie, obwieszczenie
   - "attachment" - załącznik (tabela, mapa)
   - "reference_material" - materiał zewnętrzny, analiza
   - "news" - aktualności, informacje
   - "other" - inny

2. **hierarchyLevel** - poziom ważności (1-5):
   - 1: Budżet, Uchwały, Porządek obrad (Krytyczne)
   - 2: Projekty uchwał, Protokoły, Interpelacje, Transkrypcje (Wysoka ważność)
   - 3: Wideo, Opinie komisji, Uzasadnienia, Materiały sesyjne (Średni priorytet)
   - 4: Zarządzenia, Ogłoszenia (Niska ważność)
   - 5: Załączniki, Analizy zewn., Newsy, Inne (Tło)

3. **sessionNumber** - numer sesji (ZAWSZE jako liczba arabska, np. 23, nie XXIII):
   - Wykryj z tytułu: "Sesja Nr XXIII" → 23, "XIV Sesja" → 14, "sesja 45" → 45
   - Jeśli brak informacji o sesji → null

3. **sessionType** - typ sesji (jeśli dotyczy):
   - "ordinary" - zwyczajna
   - "extraordinary" - nadzwyczajna
   - "budget" - budżetowa
   - null jeśli nie dotyczy

4. **topics** - lista tematów (max 5, znormalizowane nazwy):
   - Przykłady: ["budżet gminy", "oświata", "drogi i transport", "ochrona środowiska"]

5. **confidence** - pewność identyfikacji (0-100):
   - Ogólna pewność analizy
   - Pewność numeru sesji (jeśli dotyczy)

ZASADY:
- Numery rzymskie ZAWSZE konwertuj na arabskie
- Jeśli informacja jest niejednoznaczna - niższa pewność
- Tematy w formie znormalizowanej (małe litery, bez skrótów)
- Jeśli nie ma informacji - użyj null

ODPOWIEDŹ (TYLKO JSON, bez dodatkowego tekstu):`;

    try {
      const response = await this.llmClient!.chat.completions.create({
        model: this.modelName,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1, // Niska temperatura dla deterministycznych wyników
      });

      // Usuń markdown code fence jeśli model zwrócił ```json ... ```
      let jsonContent = response.choices[0]?.message?.content || "{}";
      jsonContent = jsonContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const result = JSON.parse(jsonContent);

      // Mapuj wynik LLM na nasz schemat
      return {
        documentType: result.documentType || "other",
        hierarchyLevel: result.hierarchyLevel || 5, // Domyślnie najniższy
        sessionInfo: result.sessionNumber
          ? {
              sessionNumber: result.sessionNumber,
              sessionType: result.sessionType || undefined,
            }
          : undefined,
        topics: result.topics || [],
        keywords: [],
        source: {
          origin: rawDocument.sourceType,
          url: rawDocument.url,
          scrapedAt: new Date().toISOString(),
        },
        confidence: {
          overall: result.confidence || 50,
          sessionNumber: result.sessionNumber
            ? result.confidence || 50
            : undefined,
          documentType: result.confidence || 50,
        },
      };
    } catch (error) {
      console.error("[DocumentNormalizer] LLM extraction error:", error);

      // Fallback - podstawowa ekstrakcja regex
      return this.fallbackExtraction(rawDocument);
    }
  }

  /**
   * Fallback - podstawowa ekstrakcja bez LLM
   */
  private fallbackExtraction(rawDocument: {
    title: string;
    sourceType: string;
    url?: string;
  }): NormalizedDocumentMetadata {
    const title = rawDocument.title.toLowerCase();

    // Prosta detekcja typu
    let documentType: DocumentType = "other";
    if (title.includes("uchwał")) documentType = "resolution";
    else if (title.includes("protokół")) documentType = "protocol";
    else if (title.includes("transkrypcj")) documentType = "transcription";
    else if (title.includes("porządek") || title.includes("projekt"))
      documentType = "session_materials";

    // Prosta ekstrakcja numeru sesji
    const sessionMatch = title.match(/sesj[iaęy]\s+(?:nr\.?\s*)?([IVXLC\d]+)/i);
    let sessionNumber: number | undefined;

    if (sessionMatch && sessionMatch[1]) {
      const value = sessionMatch[1];
      if (/^\d+$/.test(value)) {
        sessionNumber = parseInt(value, 10);
      } else if (/^[IVXLC]+$/i.test(value)) {
        sessionNumber = this.romanToArabic(value);
      }
    }

    // Określ hierarchyLevel na podstawie typu dokumentu
    const hierarchyLevel = (DOCUMENT_HIERARCHY_LEVELS[documentType] || 5) as
      | 1
      | 2
      | 3
      | 4
      | 5;

    return {
      documentType,
      hierarchyLevel,
      sessionInfo: sessionNumber ? { sessionNumber } : undefined,
      topics: [],
      keywords: [],
      source: {
        origin: rawDocument.sourceType,
        url: rawDocument.url,
        scrapedAt: new Date().toISOString(),
      },
      confidence: {
        overall: 30, // Niska pewność dla fallback
        sessionNumber: sessionNumber ? 30 : undefined,
      },
    };
  }

  /**
   * Walidacja i wzbogacenie metadanych
   */
  private validateAndEnrich(
    metadata: NormalizedDocumentMetadata,
    rawDocument: { title: string; content?: string }
  ): NormalizedDocumentMetadata {
    // Walidacja numeru sesji
    if (metadata.sessionInfo?.sessionNumber) {
      const num = metadata.sessionInfo.sessionNumber;
      if (num < 1 || num > 200) {
        console.warn(
          `[DocumentNormalizer] Invalid session number: ${num}, removing`
        );
        metadata.sessionInfo = undefined;
      }
    }

    // Walidacja hierarchyLevel
    // Jeśli LLM zwrócił dziwny poziom dla danego typu, skoryguj go (chyba że to 'other')
    const expectedLevel = DOCUMENT_HIERARCHY_LEVELS[metadata.documentType];
    if (expectedLevel && metadata.hierarchyLevel !== expectedLevel) {
      // Pozwalamy na małe odchylenia (+/- 1) w decyzji LLM, ale przy dużych różnicach korygujemy
      if (Math.abs(metadata.hierarchyLevel - expectedLevel) > 1) {
        console.warn(
          `[DocumentNormalizer] Correcting hierarchyLevel for ${metadata.documentType}: ${metadata.hierarchyLevel} -> ${expectedLevel}`
        );
        metadata.hierarchyLevel = expectedLevel as 1 | 2 | 3 | 4 | 5;
      }
    }

    // Dodaj tytuł do keywords
    const titleWords = rawDocument.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    metadata.keywords = [...new Set(titleWords)].slice(0, 10);

    return metadata;
  }

  /**
   * Konwersja numerów rzymskich na arabskie
   */
  private romanToArabic(roman: string): number {
    const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
    let result = 0;
    let prev = 0;

    for (let i = roman.length - 1; i >= 0; i--) {
      const char = roman[i];
      const curr = char ? values[char.toUpperCase()] || 0 : 0;
      result += curr < prev ? -curr : curr;
      prev = curr;
    }

    return result;
  }
}

// ============================================================================
// PRZYKŁAD UŻYCIA
// ============================================================================

/**
 * Przykład normalizacji dokumentu z różnych źródeł
 */
export async function exampleUsage() {
  const normalizer = new DocumentNormalizer("user-id");
  await normalizer.initialize();

  // Przykład 1: Chaotyczny tytuł z BIP
  const doc1 = await normalizer.normalize({
    title: "Sesja Nr XXIII | Urząd Miejski w Drawnie | System Rada",
    sourceType: "System Rada",
    url: "https://example.com/sesja-23",
  });
  console.log("Znormalizowany:", doc1);
  // → sessionInfo.sessionNumber = 23 (arabski!)

  // Przykład 2: YouTube z nietypowym formatem
  const doc2 = await normalizer.normalize({
    title: "XIV Sesja Rady Miejskiej - transmisja na żywo",
    sourceType: "YouTube",
    url: "https://youtube.com/watch?v=abc",
  });
  console.log("Znormalizowany:", doc2);
  // → sessionInfo.sessionNumber = 14, documentType = "video"

  // Przykład 3: BIP z protokołem
  const doc3 = await normalizer.normalize({
    title: "Protokół z 45 sesji Rady Gminy",
    sourceType: "BIP",
    content: "W dniu 15 stycznia 2024 odbyła się...",
  });
  console.log("Znormalizowany:", doc3);
  // → sessionInfo.sessionNumber = 45, documentType = "protocol"
}
