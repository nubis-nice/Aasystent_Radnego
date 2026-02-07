/**
 * Rejestracja wszystkich narzędzi
 */

import { ToolRegistry } from "../orchestrator/tool-registry.js";
import { gusStatisticsTool } from "./gus-statistics.js";
import { sessionSearchTool } from "./session-search.js";
import {
  isapLegalTool,
  geoportalTool,
  terytTool,
  krsTool,
  ceidgTool,
  gdosTool,
  euFundsTool,
} from "./public-data-tools.js";

export function registerAllTools(): void {
  console.log("[Tools] Registering all tools...");

  // Public Data Tools
  ToolRegistry.register(gusStatisticsTool);
  ToolRegistry.register(isapLegalTool);
  ToolRegistry.register(terytTool);
  ToolRegistry.register(krsTool);
  ToolRegistry.register(ceidgTool);
  ToolRegistry.register(gdosTool);
  ToolRegistry.register(euFundsTool);

  // Spatial Tools
  ToolRegistry.register(geoportalTool);

  // Local Documents Tools
  ToolRegistry.register(sessionSearchTool);

  console.log(`[Tools] Registered ${ToolRegistry.size} tools`);
}

export { gusStatisticsTool } from "./gus-statistics.js";
export { sessionSearchTool } from "./session-search.js";
export * from "./public-data-tools.js";
