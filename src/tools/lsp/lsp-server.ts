import { LSPClient } from "./lsp-client"
import { registerLspManagerProcessCleanup } from "./lsp-manager-process-cleanup"
import { cleanupTempDirectoryLspClients } from "./lsp-manager-temp-directory-cleanup"
import type { ResolvedServer } from "./types"

interface ManagedClient {
  client: LSPClient
  lastUsedAt: number
  refCount: number
  initPromise?: Promise<void>
  isInitializing: boolean
  initializingSince?: number
}

class LSPServerManager {
  private static instance: LSPServerManager
  private clients = new Map<string, ManagedClient>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000
  private readonly INIT_TIMEOUT = 60 * 1000

  private constructor() {
    this.startCleanupTimer()
    this.registerProcessCleanup()
  }

  static getInstance(): LSPServerManager {
    if (!LSPServerManager.instance) {
      LSPServerManager.instance = new LSPServerManager()
    }
    return LSPServerManager.instance
  }

  private getKey(root: string, serverId: string): string {
    return `${root}::${serverId}`
  }

  private startCleanupTimer(): void {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => this.cleanupIdleClients(), 60_000)
    }
  }

  private registerProcessCleanup(): void {
    registerLspManagerProcessCleanup({
      getClients: () => this.clients.entries(),
      clearClients: () => this.clients.clear(),
      clearCleanupInterval: () => {
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval)
          this.cleanupInterval = null
        }
      },
    })
  }

  private cleanupIdleClients(): void {
    const now = Date.now()
    for (const [key, managed] of this.clients.entries()) {
      if (managed.refCount === 0 && now - managed.lastUsedAt > this.IDLE_TIMEOUT) {
        void managed.client.stop()
        this.clients.delete(key)
      }
    }
  }

  async getClient(root: string, server: ResolvedServer): Promise<LSPClient> {
    const key = this.getKey(root, server.id)
    let managed = this.clients.get(key)

    if (managed?.isInitializing && managed.initializingSince && Date.now() - managed.initializingSince >= this.INIT_TIMEOUT) {
      await managed.client.stop().catch(() => {})
      this.clients.delete(key)
      managed = undefined
    }

    if (managed?.initPromise) {
      await managed.initPromise.catch(async () => {
        await managed?.client.stop().catch(() => {})
        this.clients.delete(key)
      })
      managed = this.clients.get(key)
    }

    if (managed?.client.isAlive()) {
      managed.refCount += 1
      managed.lastUsedAt = Date.now()
      return managed.client
    }

    if (managed) {
      await managed.client.stop().catch(() => {})
      this.clients.delete(key)
    }

    const client = new LSPClient(root, server)
    const initPromise = (async () => {
      await client.start()
      await client.initialize()
    })()

    this.clients.set(key, {
      client,
      lastUsedAt: Date.now(),
      refCount: 1,
      initPromise,
      isInitializing: true,
      initializingSince: Date.now(),
    })

    await initPromise.catch(async (error) => {
      this.clients.delete(key)
      await client.stop().catch(() => {})
      throw error
    })

    const initialized = this.clients.get(key)
    if (initialized) {
      initialized.initPromise = undefined
      initialized.isInitializing = false
      initialized.initializingSince = undefined
    }

    return client
  }

  releaseClient(root: string, serverId: string): void {
    const managed = this.clients.get(this.getKey(root, serverId))
    if (managed && managed.refCount > 0) {
      managed.refCount -= 1
      managed.lastUsedAt = Date.now()
    }
  }

  isServerInitializing(root: string, serverId: string): boolean {
    return this.clients.get(this.getKey(root, serverId))?.isInitializing ?? false
  }

  async stopAll(): Promise<void> {
    for (const managed of this.clients.values()) {
      await managed.client.stop().catch(() => {})
    }
    this.clients.clear()
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  async cleanupTempDirectoryClients(): Promise<void> {
    await cleanupTempDirectoryLspClients(this.clients)
  }
}

export const lspManager = LSPServerManager.getInstance()
