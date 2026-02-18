import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { OhMyOpenCodexConfig } from "../config/schema/oh-my-opencodex-config"
import { SessionStore } from "../features/session-store"
import { ThreadPool } from "../orchestrator/thread-pool"
import type { McpToolContext } from "./types"
import { registerLspTools } from "./tool-schemas/lsp-tools"
import { registerSearchTools } from "./tool-schemas/search-tools"
import { registerSessionTools } from "./tool-schemas/session-tools"
import { registerUtilityTools } from "./tool-schemas/utility-tools"

export function registerTools(
  server: McpServer,
  config: OhMyOpenCodexConfig,
  workingDirectory: string,
): void {
  const context: McpToolContext = {
    workingDirectory,
    config,
    disabledTools: new Set(config.disabled_tools ?? []),
    sessionStore: new SessionStore(workingDirectory),
    threadPool: new ThreadPool({
      maxConcurrent: config.background_task?.max_concurrent,
    }),
  }

  registerLspTools(server, context)
  registerSearchTools(server, context)
  registerSessionTools(server, context)
  registerUtilityTools(server, context)
}
