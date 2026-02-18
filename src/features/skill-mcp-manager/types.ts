import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

export interface SkillMcpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface SkillMcpClientInfo {
  serverName: string
  skillName: string
  sessionID: string
}

export interface SkillMcpServerContext {
  config: SkillMcpServerConfig
  skillName: string
}

export interface ManagedClient {
  client: Client
  transport: StdioClientTransport
  skillName: string
  lastUsedAt: number
}

export interface ProcessCleanupHandler {
  signal: NodeJS.Signals
  listener: () => void
}

export interface SkillMcpManagerState {
  clients: Map<string, ManagedClient>
  pendingConnections: Map<string, Promise<Client>>
  cleanupRegistered: boolean
  cleanupInterval: ReturnType<typeof setInterval> | null
  cleanupHandlers: ProcessCleanupHandler[]
  idleTimeoutMs: number
}
