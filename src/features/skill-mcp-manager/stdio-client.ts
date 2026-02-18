import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { registerProcessCleanup, startCleanupTimer } from "./cleanup"
import { filterSensitiveEnvVars } from "./env-cleaner"
import type { SkillMcpManagerState, SkillMcpServerConfig } from "./types"

interface StdioClientParams {
  state: SkillMcpManagerState
  clientKey: string
  skillName: string
  serverName: string
  config: SkillMcpServerConfig
}

export async function createStdioClient(params: StdioClientParams): Promise<Client> {
  const { state, clientKey, skillName, serverName, config } = params
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    env: filterSensitiveEnvVars(config.env),
    stderr: "ignore",
  })

  const client = new Client(
    { name: `skill-mcp-${skillName}-${serverName}`, version: "1.0.0" },
    { capabilities: {} }
  )

  try {
    await client.connect(transport)
  } catch (error) {
    await transport.close().catch(() => undefined)
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed connecting to MCP server "${serverName}": ${message}`)
  }

  state.clients.set(clientKey, { client, transport, skillName, lastUsedAt: Date.now() })
  registerProcessCleanup(state)
  startCleanupTimer(state)
  return client
}
