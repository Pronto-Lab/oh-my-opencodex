import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import { registerPrompts } from "./prompt-registry"
import { registerResources } from "./resource-registry"
import { registerTools } from "./tool-registry"

export function createMcpServer(
  config: OhMyCodexConfig,
  workingDirectory: string,
): McpServer {
  const server = new McpServer({
    name: "oh-my-codex",
    version: "1.0.0",
  })

  registerTools(server, config, workingDirectory)
  registerResources(server, config, workingDirectory)
  registerPrompts(server, config)

  return server
}

export async function startMcpServer(
  config: OhMyCodexConfig,
  workingDirectory: string,
): Promise<void> {
  const server = createMcpServer(config, workingDirectory)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
