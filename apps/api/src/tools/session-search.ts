/**
 * Narzędzie Session Search
 * Wyszukuje sesje rady gminy w lokalnej bazie dokumentów
 */

import type { ToolDefinition, ToolContext, ToolResult } from "../orchestrator/types.js";
import { supabase } from "../lib/supabase.js";

export const sessionSearchTool: ToolDefinition = {
  name: "session_search",
  description: "Wyszukuje informacje o sesjach rady gminy - porządek obrad, uchwały, daty posiedzeń. Przeszukuje lokalną bazę dokumentów.",
  category: "local_documents",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Fraza wyszukiwania - temat, numer sesji, data, nazwa uchwały"
      },
      session_number: {
        type: "integer",
        description: "Numer sesji (opcjonalnie)"
      },
      year: {
        type: "integer",
        description: "Rok sesji (opcjonalnie)"
      },
      limit: {
        type: "integer",
        description: "Maksymalna liczba wyników (domyślnie 5)"
      }
    },
    required: ["query"]
  },
  
  execute: async (args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    const startTime = Date.now();
    const query = args.query as string;
    const sessionNumber = args.session_number as number | undefined;
    const year = args.year as number | undefined;
    const limit = (args.limit as number) || 5;

    console.log(`[Session Search] Executing: query="${query}", session=${sessionNumber}, year=${year}`);

    try {
      let dbQuery = supabase
        .from("processed_documents")
        .select("id, title, content, document_type, publish_date, source_url, metadata, session_number")
        .eq("user_id", context.userId)
        .or("document_type.eq.session,document_type.eq.agenda,document_type.eq.resolution")
        .order("publish_date", { ascending: false })
        .limit(limit * 2);

      // Filtruj po numerze sesji
      if (sessionNumber) {
        dbQuery = dbQuery.eq("session_number", sessionNumber);
      }

      // Filtruj po roku
      if (year) {
        dbQuery = dbQuery.gte("publish_date", `${year}-01-01`)
                        .lte("publish_date", `${year}-12-31`);
      }

      const { data: documents, error } = await dbQuery;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!documents || documents.length === 0) {
        return {
          success: true,
          data: {
            sessions: [],
            message: "Nie znaleziono sesji pasujących do zapytania",
            query,
          },
          metadata: {
            source: "Lokalna baza dokumentów",
            executionTimeMs: Date.now() - startTime,
          }
        };
      }

      // Filtruj po treści zapytania
      const filteredDocs = documents.filter(doc => {
        const searchText = `${doc.title || ""} ${doc.content || ""}`.toLowerCase();
        const queryWords = query.toLowerCase().split(/\s+/);
        return queryWords.some(word => searchText.includes(word));
      }).slice(0, limit);

      const sessions = filteredDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        sessionNumber: doc.session_number,
        type: doc.document_type,
        date: doc.publish_date,
        sourceUrl: doc.source_url,
        excerpt: extractExcerpt(doc.content, query),
        metadata: doc.metadata,
      }));

      return {
        success: true,
        data: {
          sessions,
          totalFound: sessions.length,
          query,
        },
        metadata: {
          source: "Lokalna baza dokumentów RAG",
          executionTimeMs: Date.now() - startTime,
        }
      };
    } catch (error) {
      console.error("[Session Search] Error:", error);
      return {
        success: false,
        error: `Błąd wyszukiwania: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          source: "Lokalna baza dokumentów",
          executionTimeMs: Date.now() - startTime,
        }
      };
    }
  }
};

function extractExcerpt(content: string | null, query: string, maxLength = 200): string {
  if (!content) return "";
  
  const lowerContent = content.toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // Znajdź pierwszą pozycję dowolnego słowa z zapytania
  let pos = -1;
  for (const word of queryWords) {
    const idx = lowerContent.indexOf(word);
    if (idx !== -1 && (pos === -1 || idx < pos)) {
      pos = idx;
    }
  }

  if (pos === -1) {
    return content.substring(0, maxLength) + (content.length > maxLength ? "..." : "");
  }

  const start = Math.max(0, pos - 50);
  const end = Math.min(content.length, pos + maxLength);
  
  let excerpt = content.substring(start, end);
  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt = excerpt + "...";
  
  return excerpt;
}
