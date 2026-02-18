import type { ManagedClient, SkillMcpManagerState } from "./types"

async function closeManagedClient(managed: ManagedClient): Promise<void> {
  await managed.client.close().catch(() => undefined)
  await managed.transport.close().catch(() => undefined)
}

export function registerProcessCleanup(state: SkillMcpManagerState): void {
  if (state.cleanupRegistered) {
    return
  }

  state.cleanupRegistered = true
  const register = (signal: NodeJS.Signals) => {
    const listener = () => void disconnectAll(state).catch(() => undefined)
    state.cleanupHandlers.push({ signal, listener })
    process.on(signal, listener)
  }

  register("SIGINT")
  register("SIGTERM")
  if (process.platform === "win32") {
    register("SIGBREAK")
  }
}

export function startCleanupTimer(state: SkillMcpManagerState): void {
  if (state.cleanupInterval) {
    return
  }

  state.cleanupInterval = setInterval(() => {
    void cleanupIdleClients(state).catch(() => undefined)
  }, 60_000)
  state.cleanupInterval.unref()
}

async function cleanupIdleClients(state: SkillMcpManagerState): Promise<void> {
  const now = Date.now()
  for (const [key, managed] of state.clients.entries()) {
    if (now - managed.lastUsedAt <= state.idleTimeoutMs) {
      continue
    }
    state.clients.delete(key)
    await closeManagedClient(managed)
  }
}

export async function disconnectSession(state: SkillMcpManagerState, sessionID: string): Promise<void> {
  for (const [key, managed] of state.clients.entries()) {
    if (!key.startsWith(`${sessionID}:`)) {
      continue
    }
    state.clients.delete(key)
    state.pendingConnections.delete(key)
    await closeManagedClient(managed)
  }
}

export async function disconnectAll(state: SkillMcpManagerState): Promise<void> {
  if (state.cleanupInterval) {
    clearInterval(state.cleanupInterval)
    state.cleanupInterval = null
  }

  for (const { signal, listener } of state.cleanupHandlers) {
    process.off(signal, listener)
  }
  state.cleanupHandlers = []
  state.cleanupRegistered = false

  const clients = Array.from(state.clients.values())
  state.clients.clear()
  state.pendingConnections.clear()
  for (const managed of clients) {
    await closeManagedClient(managed)
  }
}

export async function forceReconnect(state: SkillMcpManagerState, clientKey: string): Promise<boolean> {
  const existing = state.clients.get(clientKey)
  if (!existing) {
    return false
  }

  state.clients.delete(clientKey)
  await closeManagedClient(existing)
  return true
}
