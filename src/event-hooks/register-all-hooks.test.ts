import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

type RegisterAllHooksModule = typeof import("./register-all-hooks")

type HookShape = {
  event: "turn:started" | "turn:completed" | "turn:failed" | "item:completed"
  priority: number
  handler: () => Promise<void>
}

function createHook(event: HookShape["event"], priority: number): HookShape {
  return { event, priority, handler: async () => {} }
}

async function importWithMocks(calls: string[]): Promise<RegisterAllHooksModule> {
  mock.module("./turn-hooks", () => ({
    createTurnStartedHook: () => createHook("turn:started", 10),
    createTurnCompletedHook: () => createHook("turn:completed", 20),
    createTurnFailedHook: () => createHook("turn:failed", 30),
  }))

  mock.module("./session", () => ({
    createSessionRecoveryHook: () => createHook("turn:started", 40),
    createUsageMonitorHook: () => createHook("turn:completed", 50),
    createNotificationHook: () => createHook("turn:completed", 60),
    createAutoUpdateCheckerHook: () => createHook("turn:started", 70),
    createKeywordDetectorHook: () => createHook("turn:started", 80),
    createThinkModeHook: () => createHook("turn:completed", 90),
  }))

  mock.module("./item-hooks", () => ({
    createFileChangeCheckerHook: () => createHook("item:completed", 100),
    createTodoListWatcherHook: () => createHook("item:completed", 110),
    createCommandWatcherHook: () => createHook("item:completed", 120),
    createMcpToolWatcherHook: () => createHook("item:completed", 130),
  }))

  mock.module("./continuation", () => ({
    createStopGuardHook: () => calls.push("stop-guard"),
    createEmptyResponseDetectorHook: () => calls.push("empty-response-detector"),
    createBackgroundCompletedHook: () => calls.push("background-completed"),
    createBoulderHook: () => calls.push("boulder"),
    createRalphLoopHook: () => calls.push("ralph-loop"),
  }))

  mock.module("./skill-hooks", () => ({
    createCategorySkillReminderHook: () => calls.push("category-skill-reminder"),
    createAutoSlashCommandHook: () => calls.push("auto-slash-command"),
  }))

  const moduleUrl = new URL(
    `./register-all-hooks.ts?test=${Date.now()}-${Math.random()}`,
    import.meta.url,
  )
  return (await import(moduleUrl.href)) as RegisterAllHooksModule
}

describe("registerAllHooks", () => {
  beforeEach(() => {
    mock.restore()
  })

  afterEach(() => {
    mock.restore()
  })

  it("registers all core hooks when none are disabled", async () => {
    const sideEffectCalls: string[] = []
    const registeredNames: string[] = []
    const registry = {
      register: (name: string) => {
        registeredNames.push(name)
      },
    }

    const { registerAllHooks } = await importWithMocks(sideEffectCalls)
    registerAllHooks(
      registry as unknown as Parameters<typeof registerAllHooks>[0],
      {},
      "/tmp/workspace",
    )

    expect(registeredNames).toEqual([
      "turn-started-hook",
      "turn-completed-hook",
      "turn-failed-hook",
      "session-recovery-hook",
      "usage-monitor-hook",
      "notification-hook",
      "auto-update-checker-hook",
      "keyword-detector-hook",
      "think-mode-hook",
      "file-change-checker-hook",
      "todo-list-watcher-hook",
      "command-watcher-hook",
      "mcp-tool-watcher-hook",
    ])
    expect(sideEffectCalls).toEqual([
      "stop-guard",
      "empty-response-detector",
      "background-completed",
      "boulder",
      "ralph-loop",
      "category-skill-reminder",
      "auto-slash-command",
    ])
  })

  it("skips hooks listed in disabled_hooks config", async () => {
    const sideEffectCalls: string[] = []
    const registeredNames: string[] = []
    const registry = {
      register: (name: string) => {
        registeredNames.push(name)
      },
    }

    const { registerAllHooks } = await importWithMocks(sideEffectCalls)
    registerAllHooks(
      registry as unknown as Parameters<typeof registerAllHooks>[0],
      {
        disabled_hooks: [
          "turn-started-hook",
          "usage-monitor-hook",
          "stop-guard",
          "category-skill-reminder",
        ],
      },
      "/tmp/workspace",
    )

    expect(registeredNames).not.toContain("turn-started-hook")
    expect(registeredNames).not.toContain("usage-monitor-hook")
    expect(registeredNames).toContain("turn-completed-hook")
    expect(sideEffectCalls).not.toContain("stop-guard")
    expect(sideEffectCalls).not.toContain("category-skill-reminder")
    expect(sideEffectCalls).toContain("auto-slash-command")
  })
})
