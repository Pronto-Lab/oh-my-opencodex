import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { forceReconnect } from "./cleanup"
import { createStdioClient } from "./stdio-client"
import type { SkillMcpClientInfo, SkillMcpManagerState, SkillMcpServerConfig } from "./types"

interface ConnectionParams {
  state: SkillMcpManagerState
  clientKey: string
  info: SkillMcpClientInfo
  config: SkillMcpServerConfig
}

export async function getOrCreateClient(params: ConnectionParams): Promise<Client> {
  const { state, clientKey, info, config } = params

  const existing = state.clients.get(clientKey)
  if (existing) {
    existing.lastUsedAt = Date.now()
    return existing.client
  }

  const pending = state.pendingConnections.get(clientKey)
  if (pending) {
    return pending
  }

  const connectionPromise = createStdioClient({
    state,
    clientKey,
    skillName: info.skillName,
    serverName: info.serverName,
    config,
  })

  state.pendingConnections.set(clientKey, connectionPromise)
  try {
    return await connectionPromise
  } finally {
    state.pendingConnections.delete(clientKey)
  }
}

export async function getOrCreateClientWithRetry(params: ConnectionParams): Promise<Client> {
  const { state, clientKey } = params

  try {
    return await getOrCreateClient(params)
  } catch (error) {
    const reconnected = await forceReconnect(state, clientKey)
    if (!reconnected) {
      throw error
    }
    return await getOrCreateClient(params)
  }
}
