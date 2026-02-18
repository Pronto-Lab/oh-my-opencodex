import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Prompt, Resource, Tool } from "@modelcontextprotocol/sdk/types.js"
import { disconnectAll, disconnectSession, forceReconnect } from "./cleanup"
import { getOrCreateClient, getOrCreateClientWithRetry } from "./connection"
import type { SkillMcpClientInfo, SkillMcpManagerState, SkillMcpServerConfig, SkillMcpServerContext } from "./types"

export class SkillMcpManager {
  private readonly state: SkillMcpManagerState = {
    clients: new Map(),
    pendingConnections: new Map(),
    cleanupRegistered: false,
    cleanupInterval: null,
    cleanupHandlers: [],
    idleTimeoutMs: 5 * 60 * 1000,
  }

  private getClientKey(info: SkillMcpClientInfo): string {
    return `${info.sessionID}:${info.skillName}:${info.serverName}`
  }

  async getOrCreateClient(info: SkillMcpClientInfo, config: SkillMcpServerConfig): Promise<Client> {
    return await getOrCreateClient({ state: this.state, clientKey: this.getClientKey(info), info, config })
  }

  async callTool(
    info: SkillMcpClientInfo,
    context: SkillMcpServerContext,
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return await this.withOperationRetry(info, context.config, async (client) => {
      const result = await client.callTool({ name, arguments: args })
      return result.content
    })
  }

  async readResource(info: SkillMcpClientInfo, context: SkillMcpServerContext, uri: string): Promise<unknown> {
    return await this.withOperationRetry(info, context.config, async (client) => {
      const result = await client.readResource({ uri })
      return result.contents
    })
  }

  async getPrompt(
    info: SkillMcpClientInfo,
    context: SkillMcpServerContext,
    name: string,
    args: Record<string, string>
  ): Promise<unknown> {
    return await this.withOperationRetry(info, context.config, async (client) => {
      const result = await client.getPrompt({ name, arguments: args })
      return result.messages
    })
  }

  async listTools(info: SkillMcpClientInfo, context: SkillMcpServerContext): Promise<Tool[]> {
    const client = await this.getOrCreateClientWithRetry(info, context.config)
    const result = await client.listTools()
    return result.tools
  }

  async listResources(info: SkillMcpClientInfo, context: SkillMcpServerContext): Promise<Resource[]> {
    const client = await this.getOrCreateClientWithRetry(info, context.config)
    const result = await client.listResources()
    return result.resources
  }

  async listPrompts(info: SkillMcpClientInfo, context: SkillMcpServerContext): Promise<Prompt[]> {
    const client = await this.getOrCreateClientWithRetry(info, context.config)
    const result = await client.listPrompts()
    return result.prompts
  }

  async disconnectAll(): Promise<void> {
    await disconnectAll(this.state)
  }

  async disconnectSession(sessionID: string): Promise<void> {
    await disconnectSession(this.state, sessionID)
  }

  getConnectedServers(): string[] {
    return Array.from(this.state.clients.keys())
  }

  private async getOrCreateClientWithRetry(info: SkillMcpClientInfo, config: SkillMcpServerConfig): Promise<Client> {
    return await getOrCreateClientWithRetry({ state: this.state, clientKey: this.getClientKey(info), info, config })
  }

  private async withOperationRetry<T>(
    info: SkillMcpClientInfo,
    config: SkillMcpServerConfig,
    operation: (client: Client) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const client = await this.getOrCreateClientWithRetry(info, config)
        return await operation(client)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const disconnected = lastError.message.toLowerCase().includes("not connected")
        if (!disconnected || attempt === 3) {
          throw lastError
        }
        await forceReconnect(this.state, this.getClientKey(info))
      }
    }

    throw lastError ?? new Error("Skill MCP operation failed")
  }
}
