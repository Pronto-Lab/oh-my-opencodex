import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod/v4"
import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"

export function registerTools(
  server: McpServer,
  config: OhMyCodexConfig,
  _workingDirectory: string,
): void {
  const disabledTools = new Set(config.disabled_tools ?? [])

  if (!disabledTools.has("mcp_ping")) {
    server.registerTool(
      "mcp_ping",
      {
        title: "MCP Ping",
        description: "Connectivity scaffold tool for MCP server setup",
        inputSchema: z.object({
          message: z.string().optional(),
        }),
      },
      async ({ message }) => ({
        content: [
          {
            type: "text",
            text: message ?? "pong",
          },
        ],
      }),
    )
  }
}
