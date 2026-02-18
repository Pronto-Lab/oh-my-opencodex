type ManagedClientForCleanup = {
  client: {
    stop: () => Promise<void>
  }
}

type ProcessCleanupOptions = {
  getClients: () => IterableIterator<[string, ManagedClientForCleanup]>
  clearClients: () => void
  clearCleanupInterval: () => void
}

export function registerLspManagerProcessCleanup(options: ProcessCleanupOptions): void {
  const syncCleanup = () => {
    for (const [, managed] of options.getClients()) {
      void managed.client.stop().catch(() => {})
    }
    options.clearClients()
    options.clearCleanupInterval()
  }

  const asyncCleanup = async () => {
    const stopPromises: Promise<void>[] = []
    for (const [, managed] of options.getClients()) {
      stopPromises.push(managed.client.stop().catch(() => {}))
    }
    await Promise.allSettled(stopPromises)
    options.clearClients()
    options.clearCleanupInterval()
  }

  process.on("exit", syncCleanup)
  process.on("SIGINT", () => void asyncCleanup().catch(() => {}))
  process.on("SIGTERM", () => void asyncCleanup().catch(() => {}))
  if (process.platform === "win32") {
    process.on("SIGBREAK", () => void asyncCleanup().catch(() => {}))
  }
}
