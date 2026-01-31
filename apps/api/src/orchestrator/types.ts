/**
 * Typy dla uniwersalnego orchestratora narzędzi
 */

export interface ToolParameter {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export type ToolCategory = 
  | "public_data"      // GUS, ISAP, TERYT, KRS, CEIDG, GDOŚ
  | "local_documents"  // RAG, sesje, dokumenty
  | "spatial"          // Geoportal, mapy
  | "actions"          // Kalendarz, zadania, alerty
  | "navigation"       // Nawigacja, quick tools
  | "research";        // Deep research, web search

export interface ToolContext {
  userId: string;
  conversationHistory?: Message[];
  userMessage: string;
  apiKeys?: Map<string, string>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    source?: string;
    executionTimeMs?: number;
    cached?: boolean;
  };
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OrchestratorConfig {
  provider: "openai" | "anthropic" | "ollama" | "local";
  model: string;
  baseUrl?: string;
  apiKey?: string;
  maxToolCalls?: number;
  timeout?: number;
}

export interface OrchestratorResult {
  response: string;
  toolsUsed: string[];
  executionTimeMs: number;
  reasoning?: string;
  sources?: string[];
  uiAction?: {
    type: string;
    target?: string;
    data?: unknown;
  };
}

// Format dla OpenAI Function Calling
export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    strict?: boolean;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
}

// Format dla prompt-based tool selection
export interface PromptToolSelection {
  thought: string;
  action: string | "none";
  parameters?: Record<string, unknown>;
  answer?: string;
}
