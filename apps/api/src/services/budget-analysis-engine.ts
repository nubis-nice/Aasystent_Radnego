/**
 * Budget Analysis Engine - analiza budżetowa i wykrywanie anomalii
 * Agent AI "Winsdurf" - kontrola finansowa dla Radnego
 */

/* eslint-disable no-undef */
declare const Buffer: typeof globalThis.Buffer;

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type {
  BudgetAnalysisRequest,
  BudgetAnalysisResult,
} from "@shared/types/data-sources-api";
import { getLLMClient, getAIConfig } from "../ai/index.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class BudgetAnalysisEngine {
  private userId: string;
  private llmClient: OpenAI | null = null;
  private model: string = "gpt-4";

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initializeOpenAI(): Promise<void> {
    if (this.llmClient) return;

    this.llmClient = await getLLMClient(this.userId);
    const llmConfig = await getAIConfig(this.userId, "llm");
    this.model = llmConfig.modelName;

    console.log(
      `[BudgetAnalysisEngine] Initialized: provider=${llmConfig.provider}, model=${this.model}`
    );
  }

  async analyze(request: BudgetAnalysisRequest): Promise<BudgetAnalysisResult> {
    console.log(
      "[BudgetAnalysisEngine] Starting analysis:",
      request.analysisType
    );

    await this.initializeOpenAI();

    const document = await this.loadDocument(request.documentId);
    const compareDocument = request.compareWith
      ? await this.loadDocument(request.compareWith)
      : null;

    const rioReferences = await this.searchRIOReferences(document);

    switch (request.analysisType) {
      case "changes":
        return this.analyzeChanges(document, compareDocument, rioReferences);
      case "compliance":
        return this.analyzeCompliance(document, rioReferences);
      case "risk":
        return this.analyzeRisks(document, rioReferences);
      case "comparison":
        return this.analyzeComparison(document, compareDocument, rioReferences);
      default:
        throw new Error(`Unsupported analysis type: ${request.analysisType}`);
    }
  }

  private async loadDocument(documentId: string): Promise<any> {
    const { data: doc, error } = await supabase
      .from("processed_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", this.userId)
      .single();

    if (error || !doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    return doc;
  }

  private async searchRIOReferences(document: any): Promise<any[]> {
    const { data: rioDocuments } = await supabase
      .from("processed_documents")
      .select("*")
      .eq("user_id", this.userId)
      .contains("keywords", ["RIO", "finanse publiczne", "budżet"])
      .limit(5);

    return rioDocuments || [];
  }

  private async analyzeChanges(
    document: any,
    compareDocument: any | null,
    rioReferences: any[]
  ): Promise<BudgetAnalysisResult> {
    if (!this.llmClient) throw new Error("OpenAI not initialized");

    const systemPrompt = `Jesteś ekspertem finansów publicznych analizującym zmiany budżetowe.

Zadania:
- Wykryj wszystkie przesunięcia środków między działami, rozdziałami, paragrafami
- Zidentyfikuj zmiany pozornie redakcyjne, które zmieniają skutki finansowe
- Sprawdź zgodność z uchwałami RIO i stanowiskami MF
- Oceń ryzyko obejścia WPF (Wieloletniej Prognozy Finansowej)

Zwróć odpowiedź w formacie JSON z polami: findings, summary, rioReferences`;

    const userPrompt = this.buildBudgetPrompt(
      document,
      compareDocument,
      rioReferences
    );

    const completion = await this.llmClient.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "";
    return this.parseBudgetResponse(responseText, document.id, "changes");
  }

  private async analyzeCompliance(
    document: any,
    rioReferences: any[]
  ): Promise<BudgetAnalysisResult> {
    if (!this.llmClient) throw new Error("OpenAI not initialized");

    const systemPrompt = `Jesteś ekspertem finansów publicznych sprawdzającym zgodność budżetu.

Zadania:
- Sprawdź zgodność z ustawą o finansach publicznych
- Zweryfikuj zgodność z uchwałami RIO
- Sprawdź poprawność klasyfikacji budżetowej
- Oceń zgodność z zasadami: jawności, przejrzystości, celowości

Zwróć odpowiedź w formacie JSON z polami: findings, summary, rioReferences`;

    const userPrompt = this.buildBudgetPrompt(document, null, rioReferences);

    const completion = await this.llmClient.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "";
    return this.parseBudgetResponse(responseText, document.id, "compliance");
  }

  private async analyzeRisks(
    document: any,
    rioReferences: any[]
  ): Promise<BudgetAnalysisResult> {
    if (!this.llmClient) throw new Error("OpenAI not initialized");

    const systemPrompt = `Jesteś ekspertem finansów publicznych identyfikującym ryzyka budżetowe.

Zadania:
- Wykryj nietypowe przesunięcia środków
- Zidentyfikuj potencjalne obejścia przepisów
- Oceń ryzyko przekroczenia deficytu
- Sprawdź ryzyko naruszenia WPF
- Zidentyfikuj ukryte zmiany w załącznikach

Zwróć odpowiedź w formacie JSON z polami: findings, summary, rioReferences`;

    const userPrompt = this.buildBudgetPrompt(document, null, rioReferences);

    const completion = await this.llmClient.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "";
    return this.parseBudgetResponse(responseText, document.id, "risk");
  }

  private async analyzeComparison(
    document: any,
    compareDocument: any | null,
    rioReferences: any[]
  ): Promise<BudgetAnalysisResult> {
    if (!compareDocument) {
      throw new Error("Comparison document required for comparison analysis");
    }

    if (!this.llmClient) throw new Error("OpenAI not initialized");

    const systemPrompt = `Jesteś ekspertem finansów publicznych porównującym dokumenty budżetowe.

Zadania:
- Porównaj dwa dokumenty budżetowe (np. projekt vs uchwała)
- Wykryj wszystkie różnice w kwotach, działach, rozdziałach
- Zidentyfikuj zmiany wprowadzone podczas procedowania
- Oceń wpływ zmian na realizację zadań

Zwróć odpowiedź w formacie JSON z polami: findings, summary, rioReferences`;

    const userPrompt = this.buildComparisonPrompt(
      document,
      compareDocument,
      rioReferences
    );

    const completion = await this.llmClient.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "";
    return this.parseBudgetResponse(responseText, document.id, "comparison");
  }

  private buildBudgetPrompt(
    document: any,
    compareDocument: any | null,
    rioReferences: any[]
  ): string {
    let prompt = `Dokument do analizy:\n`;
    prompt += `Tytuł: ${document.title}\n`;
    prompt += `Data: ${document.publish_date || "brak"}\n`;
    prompt += `Treść:\n${document.content.substring(0, 5000)}...\n\n`;

    if (compareDocument) {
      prompt += `Dokument porównawczy:\n`;
      prompt += `Tytuł: ${compareDocument.title}\n`;
      prompt += `Treść:\n${compareDocument.content.substring(0, 5000)}...\n\n`;
    }

    if (rioReferences.length > 0) {
      prompt += `Referencje RIO:\n`;
      for (const ref of rioReferences) {
        prompt += `- ${ref.title}\n`;
      }
      prompt += "\n";
    }

    return prompt;
  }

  private buildComparisonPrompt(
    document: any,
    compareDocument: any,
    rioReferences: any[]
  ): string {
    let prompt = `Dokument 1 (bazowy):\n`;
    prompt += `Tytuł: ${document.title}\n`;
    prompt += `Treść:\n${document.content.substring(0, 5000)}...\n\n`;

    prompt += `Dokument 2 (porównawczy):\n`;
    prompt += `Tytuł: ${compareDocument.title}\n`;
    prompt += `Treść:\n${compareDocument.content.substring(0, 5000)}...\n\n`;

    if (rioReferences.length > 0) {
      prompt += `Referencje RIO:\n`;
      for (const ref of rioReferences) {
        prompt += `- ${ref.title}\n`;
      }
    }

    return prompt;
  }

  private parseBudgetResponse(
    responseText: string,
    documentId: string,
    analysisType: string
  ): BudgetAnalysisResult {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const findings = (parsed.findings || []).map((finding: any) => ({
        type: finding.type || "anomaly",
        severity: finding.severity || "medium",
        description: finding.description,
        affectedItems: finding.affectedItems || [],
        recommendation: finding.recommendation,
      }));

      const rioReferences = (parsed.rioReferences || []).map((ref: any) => ({
        title: ref.title,
        url: ref.url || "",
        relevance: ref.relevance,
      }));

      return {
        documentId,
        analysisType,
        findings,
        summary: parsed.summary || "Brak podsumowania",
        rioReferences,
      };
    } catch (error) {
      console.error("[BudgetAnalysisEngine] Failed to parse response:", error);

      return {
        documentId,
        analysisType,
        findings: [
          {
            type: "anomaly",
            severity: "medium",
            description: "Nie udało się automatycznie przeanalizować dokumentu",
            affectedItems: [],
            recommendation: "Przeanalizuj dokument manualnie",
          },
        ],
        summary: responseText,
        rioReferences: [],
      };
    }
  }
}
