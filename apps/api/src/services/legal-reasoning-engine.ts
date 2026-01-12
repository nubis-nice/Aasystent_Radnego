/**
 * Legal Reasoning Engine - analiza prawna z wykrywaniem ryzyk
 * Agent AI "Winsdurf" - wsparcie analityczno-kontrolne dla Radnego
 */

/* eslint-disable no-undef */
declare const Buffer: typeof globalThis.Buffer;

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { LegalSearchAPI } from "./legal-search-api.js";
import type {
  LegalReasoningRequest,
  LegalReasoningResponse,
} from "@shared/types/data-sources-api";
import { getLLMClient, getAIConfig } from "../ai/index.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class LegalReasoningEngine {
  private userId: string;
  private llmClient: OpenAI | null = null;
  private model: string = "gpt-4";
  private searchAPI: LegalSearchAPI;

  constructor(userId: string) {
    this.userId = userId;
    this.searchAPI = new LegalSearchAPI(userId);
  }

  private async initializeOpenAI(): Promise<void> {
    if (this.llmClient) return;

    this.llmClient = await getLLMClient(this.userId);
    const llmConfig = await getAIConfig(this.userId, "llm");
    this.model = llmConfig.modelName;

    console.log(
      `[LegalReasoningEngine] Initialized: provider=${llmConfig.provider}, model=${this.model}`
    );
  }

  async analyze(
    request: LegalReasoningRequest
  ): Promise<LegalReasoningResponse> {
    console.log(
      "[LegalReasoningEngine] Starting analysis:",
      request.analysisType
    );

    await this.initializeOpenAI();

    const context = await this.gatherContext(request);
    const analysis = await this.performAnalysis(request, context);

    return analysis;
  }

  private async gatherContext(request: LegalReasoningRequest): Promise<any> {
    const documents: any[] = [];

    if (
      request.context?.documentIds &&
      request.context.documentIds.length > 0
    ) {
      const { data: docs } = await supabase
        .from("processed_documents")
        .select("*")
        .in("id", request.context.documentIds)
        .eq("user_id", this.userId);

      if (docs) documents.push(...docs);
    }

    const searchResults = await this.searchAPI.search({
      query: request.question,
      searchMode: "hybrid",
      maxResults: 5,
      filters: {
        legalScope: request.context?.legalScope,
        jurisdiction: request.context?.jurisdiction,
      },
    });

    for (const result of searchResults) {
      const { data: doc } = await supabase
        .from("processed_documents")
        .select("*")
        .eq("id", result.documentId)
        .single();

      if (doc && !documents.find((d) => d.id === doc.id)) {
        documents.push(doc);
      }
    }

    return { documents, searchResults };
  }

  private async performAnalysis(
    request: LegalReasoningRequest,
    context: any
  ): Promise<LegalReasoningResponse> {
    if (!this.llmClient) {
      throw new Error("OpenAI not initialized");
    }

    const systemPrompt = this.buildSystemPrompt(request.analysisType);
    const userPrompt = this.buildUserPrompt(request, context);

    const completion = await this.llmClient.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "";

    return this.parseAnalysisResponse(responseText, context);
  }

  private buildSystemPrompt(analysisType: string): string {
    const basePrompt = `Jesteś ekspertem prawnym wspierającym Radnego w kontroli legalności i zasadności uchwał samorządowych.

Twoje zadania:
- Analiza zgodności z prawem nadrzędnym
- Wykrywanie ryzyk prawnych, finansowych i proceduralnych
- Dostarczanie argumentów i pytań kontrolnych
- Identyfikacja podstaw prawnych i delegacji ustawowych

Zasady:
- Deterministyczność: zawsze ta sama odpowiedź dla tych samych danych
- Fail fast: sygnalizuj brak danych zamiast domyślać się
- Cytuj konkretne przepisy i orzecznictwo
- Wskaż poziom ryzyka (low, medium, high, critical)
- Podaj rekomendacje działania`;

    const typeSpecific = {
      legality:
        "\n\nSkup się na zgodności z prawem: podstawy prawne, delegacje, kompetencje organu.",
      financial_risk:
        "\n\nSkup się na ryzykach finansowych: zgodność z budżetem, WPF, stanowiska RIO.",
      procedural_compliance:
        "\n\nSkup się na procedurze: tryb uchwalania, konsultacje, terminy.",
      general:
        "\n\nPrzeprowadź kompleksową analizę prawną, finansową i proceduralną.",
    };

    return (
      basePrompt +
      (typeSpecific[analysisType as keyof typeof typeSpecific] ||
        typeSpecific.general)
    );
  }

  private buildUserPrompt(
    request: LegalReasoningRequest,
    context: any
  ): string {
    let prompt = `Pytanie: ${request.question}\n\n`;

    if (context.documents && context.documents.length > 0) {
      prompt += "Dostępne dokumenty:\n\n";
      for (const doc of context.documents) {
        prompt += `--- Dokument: ${doc.title} ---\n`;
        prompt += `Typ: ${doc.document_type}\n`;
        if (doc.publish_date) prompt += `Data: ${doc.publish_date}\n`;
        prompt += `Treść: ${doc.content.substring(0, 2000)}...\n\n`;
      }
    }

    if (request.context?.legalScope) {
      prompt += `\nZakres prawny: ${request.context.legalScope.join(", ")}\n`;
    }

    if (request.context?.jurisdiction) {
      prompt += `Jurysdykcja: ${request.context.jurisdiction}\n`;
    }

    prompt += `\nPrzeprowadź analizę i zwróć odpowiedź w formacie JSON:
{
  "answer": "Zwięzła odpowiedź na pytanie",
  "reasoning": ["Krok 1 rozumowania", "Krok 2", ...],
  "legalBasis": [
    {
      "documentTitle": "Tytuł dokumentu",
      "excerpt": "Fragment dokumentu",
      "relevance": 0.9
    }
  ],
  "risks": [
    {
      "level": "low|medium|high|critical",
      "description": "Opis ryzyka",
      "legalBasis": "Podstawa prawna",
      "recommendation": "Rekomendacja działania"
    }
  ],
  "citations": [
    {
      "quote": "Cytat z dokumentu",
      "context": "Kontekst cytatu"
    }
  ]
}`;

    return prompt;
  }

  private parseAnalysisResponse(
    responseText: string,
    context: any
  ): LegalReasoningResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const legalBasis = (parsed.legalBasis || []).map((basis: any) => {
        const doc = context.documents.find(
          (d: any) =>
            d.title.includes(basis.documentTitle) ||
            basis.documentTitle.includes(d.title)
        );

        return {
          documentId: doc?.id || "",
          title: basis.documentTitle,
          excerpt: basis.excerpt,
          relevance: basis.relevance || 0.5,
        };
      });

      const risks = (parsed.risks || []).map((risk: any) => ({
        level: risk.level || "medium",
        description: risk.description,
        legalBasis: risk.legalBasis,
        recommendation: risk.recommendation,
      }));

      const citations = (parsed.citations || []).map((citation: any) => {
        const doc = context.documents.find((d: any) =>
          d.content.includes(citation.quote)
        );

        return {
          documentId: doc?.id || "",
          quote: citation.quote,
          context: citation.context,
        };
      });

      return {
        answer: parsed.answer || "Brak odpowiedzi",
        reasoning: parsed.reasoning || [],
        legalBasis,
        risks,
        citations,
      };
    } catch (error) {
      console.error("[LegalReasoningEngine] Failed to parse response:", error);

      return {
        answer: responseText,
        reasoning: [
          "Analiza przeprowadzona, ale nie udało się sparsować struktury odpowiedzi",
        ],
        legalBasis: [],
        risks: [
          {
            level: "medium",
            description: "Nie udało się automatycznie zidentyfikować ryzyk",
            recommendation: "Przeanalizuj odpowiedź manualnie",
          },
        ],
        citations: [],
      };
    }
  }
}
